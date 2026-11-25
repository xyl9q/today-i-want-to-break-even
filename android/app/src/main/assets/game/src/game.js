                                                                     
                                                            
                                       
                                                            

                             
                      
               
                 
                
               
                        
                     
                
                    
                    
                 
                      
 

                               
             
                      
                  
                   
                     
                    
 

                           
             
                
                 
                 
                
                 
                     
 

                           
               
                
               
                       
                  
                 
 

                            
             
                                
                  
 

                            
               
              
               
                        
                        
               
                       
                    
                       
                      
                     
                        
                 
                          
                        
                        
                     
                     
                       
                         
                    
                   
                      
                 
 

                                      
                      
                 
                      
                    
 

                              
              
               
                 
                        
                                   
 

const clamp = (value        , min        , max        )         => Math.max(min, Math.min(max, value));
const money = (value        )         => Math.round(value * 100) / 100;

export class DeskTraderGame {
           state           ;
          randomState        ;
          minuteAccumulator = 0;
          nextOrderId = 1;
          nextToastId = 1;
          processedMinute = 559;
                   bossWindows = [[604, 612], [650, 658], [800, 808], [856, 864]];

  constructor(seed = 20261125, career              ) {
    this.randomState = seed >>> 0;
    this.state = {
      time: 560,
      day: 1,
      cash: 100000,
      initialAssets: 100000,
      selected: 'MFCM',
      app: 'market',
      bossState: 'away',
      suspicion: 8,
      workProgress: 18,
      caughtCount: 0,
      checkedIn: false,
      checkInStreak: 0,
      tokens: 0,
      claimSequence: [],
      claimProgress: 0,
      claimDeadline: 0,
      claimUsed: false,
      radarUntil: 0,
      stocks: [
        this.stock('MFCM', '摸鱼传媒', '内容 / 热点', 18.72, 0.19, 0.012),
        this.stock('BUGX', '补丁科技', '软件 / 信创', 42.10, 0.15, 0.008),
        this.stock('NEPC', '新能源饼', '新能源 / 概念', 27.56, 0.22, -0.005),
        this.stock('CYBR', '赛博白酒', '消费 / AI', 66.66, 0.13, 0.002),
        this.stock('CASH', '现金流云', '算力 / 金融', 31.40, 0.17, 0.006),
      ],
      orders: [],
      tasks: [
        { id: 1, title: '回复“收到”', sender: '项目经理', detail: '群里 @全体成员：下午同步一下进度。', dueAt: 610, reward: 9, completed: false },
        { id: 2, title: '修复红色单测', sender: 'CI 机器人', detail: '主分支有一条祖传用例又红了。', dueAt: 675, reward: 14, completed: false },
        { id: 3, title: '补日报三句话', sender: '部门助手', detail: '今日工作、明日计划、风险问题。', dueAt: 835, reward: 12, completed: false },
        { id: 4, title: '处理合并冲突', sender: '隔壁工位', detail: '“我只改了一行，怎么冲突了？”', dueAt: 875, reward: 16, completed: false },
      ],
      news: [],
      toasts: [],
      ended: false,
    };
    if (career) this.applyCareer(career);
    this.state.news = this.createDailyNews(this.state.day);
    this.state.initialAssets = this.totalAssets();
    this.toast('info', `第 ${this.state.day} 天，09:20 到工位。先看盘，还是先去公益站签到？`);
  }

          applyCareer(career             )       {
    this.state.day = Math.max(1, Math.floor(career.day));
    this.state.cash = money(Math.max(0, career.cash));
    this.state.tokens = Math.max(0, Math.floor(career.tokens));
    this.state.checkInStreak = Math.max(0, Math.floor(career.checkInStreak));
    for (const saved of career.positions) {
      const stock = this.state.stocks.find((candidate) => candidate.symbol === saved.symbol);
      if (!stock) continue;
      stock.shares = Math.max(0, Math.floor(saved.shares / 100) * 100);
      stock.averageCost = money(Math.max(0, saved.averageCost));
      if (saved.lastPrice > 0) {
        stock.previousClose = money(saved.lastPrice);
        stock.open = stock.previousClose;
        stock.price = stock.previousClose;
        stock.history = [stock.previousClose];
      }
    }
  }

          createDailyNews(day        )             {
    const pool                                     = [
      { title: '工位生存挑战', body: '短视频平台流行“十秒切回 IDE”，内容板块突然活跃。', symbol: 'MFCM', impact: 0.028 },
      { title: '英伟达又开发布会', body: '老黄皮衣一穿，先说“越买越省”，再端出一块比工位主机还贵的板子。', symbol: 'CASH', impact: 0.026 },
      { title: '需求重新定义', body: '某大厂宣布：以后所有 Bug 都改名为“非预期特性”。', symbol: 'BUGX', impact: 0.035 },
      { title: '显卡玩家等待中', body: '新卡优先去机房训练模型，游戏玩家获得“再等等”限量版资格。', symbol: 'CASH', impact: 0.018 },
      { title: '茶水间传闻', body: '新能源饼下周发布会只讲生态，不讲参数。', symbol: 'NEPC', impact: -0.026 },
      { title: '财报心理学', body: '英伟达财报再次超预期，市场沉默三秒后追问：超得够不够多？', symbol: 'CASH', impact: -0.022 },
      { title: 'AI 调酒突破', body: '模型通过盲测，赛博白酒宣布自己也是算力消费。', symbol: 'CYBR', impact: 0.032 },
      { title: 'CUDA 护城河', body: '隔壁组试图迁移计算框架，三天后在群里说：“还是先能跑吧。”', symbol: 'BUGX', impact: -0.018 },
      { title: '机房空调恢复', body: '现金流云服务器终于不再靠开门散热，算力情绪回暖。', symbol: 'CASH', impact: 0.027 },
      { title: '皮衣概念扩散', body: '自媒体总结上涨理由：CEO 有皮衣、发布会有机器人、PPT 有万亿市场。', symbol: 'MFCM', impact: 0.019 },
      { title: '周报生成器上线', body: '三句话自动扩写三页 PPT，摸鱼传媒宣布效率革命。', symbol: 'MFCM', impact: 0.024 },
      { title: '开源模型降价', body: '推理价格又少一个零，现金流云连夜把计价单位改成“百万 Token”。', symbol: 'CASH', impact: -0.021 },
      { title: '祖传代码立功', body: '十年前的兼容层扛住大促，补丁科技决定继续不重构。', symbol: 'BUGX', impact: 0.029 },
      { title: '发布会延期', body: '新能源饼解释延期原因：PPT 的动画还不够丝滑。', symbol: 'NEPC', impact: -0.031 },
      { title: '跨界机器人', body: '赛博白酒展示人形机器人敬酒，现场唯一问题是不会劝人少喝。', symbol: 'CYBR', impact: 0.025 },
      { title: '量化模型失眠', body: '某策略把午休当交易时段，十二点整连续发出四百次撤单。', symbol: 'MFCM', impact: -0.017 },
      { title: '芯片命名升级', body: '新型号多了两个字母和一个 Plus，性能提升主要体现在型号长度。', symbol: 'CASH', impact: 0.016 },
      { title: '测试环境又绿了', body: 'CI 连续成功三次，开发群开始怀疑监控是不是坏了。', symbol: 'BUGX', impact: 0.021 },
      { title: '固态电池照片流出', body: '图片很清晰，参数很模糊，新能源饼先涨为敬。', symbol: 'NEPC', impact: 0.033 },
      { title: '消费降级研究', body: '年轻人开始用 AI 生成酒局总结，赛博白酒概念遭遇分歧。', symbol: 'CYBR', impact: -0.024 },
    ];
    const times = [582, 606, 632, 662, 786, 816, 846, 872];
    const picked             = [];
    const start = ((day - 1) * 5) % pool.length;
    for (let index = 0; index < times.length; index += 1) {
      const template = pool[(start + index * 7) % pool.length];
      picked.push({ ...template, time: times[index], fired: false });
    }
    picked.push({ time: 884, title: `第 ${day} 天尾盘提醒`, body: '今天是止盈，还是把短线做成长线？', fired: false });
    return picked;
  }

          stock(symbol             , name        , sector        , price        , volatility        , drift        )             {
    const previousClose = money(price * (0.985 + this.random() * 0.03));
    const auctionMid = money((previousClose + price) / 2 + (this.random() - .5) * price * .002);
    return { symbol, name, sector, price, open: price, previousClose, volatility, drift, sentiment: 0, history: [previousClose, auctionMid, price], shares: 0, averageCost: 0 };
  }

          random()         {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  advance(minutes        )       {
    if (this.state.ended) return;
    this.minuteAccumulator += minutes;
    while (this.minuteAccumulator >= 1 && !this.state.ended) {
      this.minuteAccumulator -= 1;
      this.advanceOneMinute();
    }
  }

          advanceOneMinute()       {
    this.state.time += 1;
    this.processedMinute += 1;
    this.updateBoss();
    this.updateExposure();
    this.fireNews();
    if (this.isMarketOpen()) this.moveMarket();
    this.fillOrders();
    this.expireClaim();
    if (this.state.time >= 900) {
      this.state.time = 900;
      this.state.ended = true;
      this.state.bossState = 'away';
      this.toast('info', '15:00 收盘。该面对今天的账户和日报了。');
    }
  }

          updateBoss()       {
    const cycle = this.state.time;
    let next            = 'away';
    for (const [start, end] of this.bossWindows) {
      if (cycle >= start && cycle < start + 5) next = 'approaching';
      if (cycle >= start + 5 && cycle < end) next = 'checking';
    }
    if (next !== this.state.bossState) {
      this.state.bossState = next;
      if (next === 'approaching') this.toast('bad', '脚步声正在靠近……老板五分钟后到达战场！');
      if (next === 'checking') {
        if (this.state.app === 'ide' || this.state.app === 'work') {
          this.state.workProgress = clamp(this.state.workProgress + 3, 0, 100);
          this.toast('good', '老板看见满屏代码，满意地点了点头。');
        } else {
          this.state.caughtCount += 1;
          this.state.suspicion = clamp(this.state.suspicion + 28, 0, 100);
          this.toast('bad', `被老板看见${this.state.app === 'station' ? '抢 Token' : '盯分时图'}！暴露度大涨。`);
        }
      }
    }
  }

  bossCountdown()                {
    if (this.state.bossState !== 'approaching') return null;
    const window = this.bossWindows.find(([start]) => this.state.time >= start && this.state.time < start + 5);
    return window ? Math.max(0, window[0] + 5 - this.state.time) : null;
  }

          updateExposure()       {
    const isSlacking = this.state.app === 'market' || this.state.app === 'station';
    const overdue = this.state.tasks.filter((task) => !task.completed && task.dueAt < this.state.time).length;
    const bossPressure = this.state.bossState === 'approaching' ? 0.7 : this.state.bossState === 'checking' ? 1.4 : 0;
    const change = isSlacking ? 0.12 + overdue * 0.04 + bossPressure : -0.22;
    this.state.suspicion = clamp(this.state.suspicion + change, 0, 100);
    if (this.state.suspicion >= 100) {
      this.state.ended = true;
      this.toast('bad', '摸鱼暴露度拉满，你被请去会议室“同步一下状态”。');
    }
  }

          fireNews()       {
    for (const item of this.state.news) {
      if (!item.fired && item.time <= this.state.time) {
        item.fired = true;
        if (item.symbol && item.impact) this.getStock(item.symbol).sentiment += item.impact;
        this.toast(item.impact && item.impact < 0 ? 'bad' : 'info', item.title + '：' + item.body);
      }
    }
  }

          moveMarket()       {
    for (const stock of this.state.stocks) {
      const noise = (this.random() - 0.5) * stock.volatility * 0.012;
      const meanReversion = ((stock.open - stock.price) / stock.open) * 0.008;
      const impulse = stock.sentiment * 0.13;
      const drift = stock.drift * 0.00022;
      const move = noise + meanReversion + impulse + drift;
      stock.price = money(clamp(stock.price * (1 + move), stock.previousClose * 0.9, stock.previousClose * 1.1));
      stock.sentiment *= 0.91;
      stock.history.push(stock.price);
      if (stock.history.length > 130) stock.history.shift();
    }
  }

          fillOrders()       {
    const remaining                 = [];
    for (const order of this.state.orders) {
      const stock = this.getStock(order.symbol);
      const canFill = order.side === 'buy' ? stock.price <= order.limitPrice : stock.price >= order.limitPrice;
      if (canFill && this.isMarketOpen()) this.execute(order.side, order.symbol, order.quantity, stock.price);
      else remaining.push(order);
    }
    this.state.orders = remaining;
  }

          expireClaim()       {
    if (this.state.claimSequence.length && this.state.time > this.state.claimDeadline) {
      this.state.claimSequence = [];
      this.state.claimProgress = 0;
      this.toast('bad', '校验超时，Token 被隔壁工位抢走了。');
    }
  }

  isMarketOpen()          {
    return (this.state.time >= 570 && this.state.time < 690) || (this.state.time >= 780 && this.state.time < 900);
  }

  marketPhase()         {
    const time = this.state.time;
    if (time < 570) return '集合竞价';
    if (time < 690) return '早盘交易';
    if (time < 780) return '午间休市';
    if (time < 897) return '午盘交易';
    if (time < 900) return '尾盘三分钟';
    return '已收盘';
  }

  getStock(symbol = this.state.selected)             {
    const stock = this.state.stocks.find((candidate) => candidate.symbol === symbol);
    if (!stock) throw new Error(`Unknown stock ${symbol}`);
    return stock;
  }

  selectStock(symbol             )       {
    this.state.selected = symbol;
    this.state.app = 'market';
  }

  switchApp(app         )       {
    this.state.app = app;
  }

  panic()       {
    this.state.app = 'ide';
    this.toast('info', '老板键：已切换到“祖传支付模块重构.ts”。');
  }

  placeOrder(side           , quantity        , limitPrice         )          {
    if (!this.isMarketOpen()) {
      this.toast('bad', '现在休市，订单没有递进交易所。');
      return false;
    }
    const stock = this.getStock();
    const normalizedQuantity = Math.floor(quantity / 100) * 100;
    if (normalizedQuantity <= 0) {
      this.toast('bad', 'A 股模拟器里至少输入 100 股。');
      return false;
    }
    const price = money(limitPrice ?? stock.price);
    if (side === 'buy' && price * normalizedQuantity > this.state.cash) {
      this.toast('bad', '余额不足。市场可以画饼，账户不行。');
      return false;
    }
    if (side === 'sell' && normalizedQuantity > stock.shares) {
      this.toast('bad', '持仓不足，暂不支持把空气卖给市场。');
      return false;
    }
    const marketable = side === 'buy' ? price >= stock.price : price <= stock.price;
    if (marketable) return this.execute(side, stock.symbol, normalizedQuantity, stock.price);
    this.state.orders.push({ id: this.nextOrderId++, symbol: stock.symbol, side, quantity: normalizedQuantity, limitPrice: price, createdAt: this.state.time });
    this.toast('info', `${side === 'buy' ? '买入' : '卖出'} ${stock.name} ${normalizedQuantity} 股，限价 ${price.toFixed(2)}，等待成交。`);
    return true;
  }

          execute(side           , symbol             , quantity        , price        )          {
    const stock = this.getStock(symbol);
    const value = money(price * quantity);
    if (side === 'buy') {
      if (value > this.state.cash) return false;
      const originalValue = stock.averageCost * stock.shares;
      stock.shares += quantity;
      stock.averageCost = money((originalValue + value) / stock.shares);
      this.state.cash = money(this.state.cash - value);
    } else {
      if (quantity > stock.shares) return false;
      stock.shares -= quantity;
      this.state.cash = money(this.state.cash + value);
      if (stock.shares === 0) stock.averageCost = 0;
    }
    this.toast('good', `${side === 'buy' ? '买入' : '卖出'}成交：${stock.name} ${quantity} 股 @ ${price.toFixed(2)}`);
    return true;
  }

  cancelOrder(id        )       {
    const before = this.state.orders.length;
    this.state.orders = this.state.orders.filter((order) => order.id !== id);
    if (this.state.orders.length < before) this.toast('info', '订单已撤，手速保住了一顿午饭。');
  }

  completeTask(id        )          {
    const task = this.state.tasks.find((candidate) => candidate.id === id);
    if (!task || task.completed) return false;
    task.completed = true;
    this.state.workProgress = clamp(this.state.workProgress + task.reward, 0, 100);
    this.state.suspicion = clamp(this.state.suspicion - 10, 0, 100);
    this.state.app = 'work';
    this.toast('good', `已处理：${task.title}。职场安全感 +${task.reward}。`);
    return true;
  }

  checkIn()          {
    if (this.state.checkedIn) return false;
    this.state.checkedIn = true;
    this.state.checkInStreak += 1;
    this.state.tokens += 2;
    this.toast('good', `公益站签到成功：Token +2，已经连续签到 ${this.state.checkInStreak} 天。`);
    return true;
  }

  isDropOpen()          {
    const time = this.state.time;
    return !this.state.claimUsed && ((time >= 700 && time <= 725) || (time >= 825 && time <= 842));
  }

  startClaim()          {
    if (!this.state.checkedIn) {
      this.toast('bad', '请先签到，再蹲补给。');
      return false;
    }
    if (!this.isDropOpen()) {
      this.toast('bad', '补给尚未开放。午休 11:40 或下午 13:45 再来看看。');
      return false;
    }
    this.state.claimSequence = Array.from({ length: 5 }, () => Math.floor(this.random() * 4));
    this.state.claimProgress = 0;
    this.state.claimDeadline = this.state.time + 8;
    this.toast('info', '补给开放！按顺序点击五个颜色节点，八分钟内完成校验。');
    return true;
  }

  submitClaimColor(color        )          {
    const expected = this.state.claimSequence[this.state.claimProgress];
    if (expected === undefined) return false;
    if (color !== expected) {
      this.state.claimProgress = 0;
      this.state.claimDeadline -= 1;
      this.toast('bad', '颜色顺序错误，校验重置并扣除一分钟。');
      return false;
    }
    this.state.claimProgress += 1;
    if (this.state.claimProgress === this.state.claimSequence.length) {
      const reward = 5 + Math.floor(this.random() * 5);
      this.state.tokens += reward;
      this.state.claimUsed = true;
      this.state.claimSequence = [];
      this.state.claimProgress = 0;
      this.toast('good', `抢领成功！Token +${reward}。隔壁工位慢了 37ms。`);
    }
    return true;
  }

  buyPerk(perk                               )          {
    const costs = { radar: 4, coffee: 3, cancel: 2 };
    const cost = costs[perk];
    if (this.state.tokens < cost) {
      this.toast('bad', 'Token 不够，公益站拒绝了你的白嫖请求。');
      return false;
    }
    this.state.tokens -= cost;
    if (perk === 'radar') {
      this.state.radarUntil = this.state.time + 45;
      this.toast('good', '市场雷达已开启：可预览下一条新闻。');
    } else if (perk === 'coffee') {
      this.state.suspicion = clamp(this.state.suspicion - 24, 0, 100);
      this.toast('good', '咖啡续命：摸鱼暴露度 -24。');
    } else {
      this.state.orders = [];
      this.toast('good', '一键撤单完成，未留下手速证据。');
    }
    return true;
  }

  totalAssets()         {
    return money(this.state.cash + this.state.stocks.reduce((sum, stock) => sum + stock.price * stock.shares, 0));
  }

  returnRate()         {
    return (this.totalAssets() - this.state.initialAssets) / this.state.initialAssets;
  }

  score()         {
    const profit = this.totalAssets() - this.state.initialAssets;
    return Math.round(profit + this.state.workProgress * 40 + this.state.tokens * 120 - this.state.caughtCount * 900 - this.state.suspicion * 8);
  }

  nextNews()                       {
    return this.state.news.find((item) => !item.fired);
  }

  drainToasts()              {
    return this.state.toasts.splice(0);
  }

          toast(tone                   , message        )       {
    this.state.toasts.push({ id: this.nextToastId++, tone, message });
  }
}

export function formatGameTime(minutes        )         {
  const hour = Math.floor(minutes / 60);
  const minute = Math.floor(minutes % 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
