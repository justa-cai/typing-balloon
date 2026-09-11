/**
 * data/words.js - 三种练习模式的题库
 *
 * 这是纯数据文件，没有任何逻辑分支——只负责"有哪些题"，
 * "按难度出哪一批"由 rules.js 决定。
 *
 * ── 为什么按长度分档，而不是手写档位标注 ──────────────────────────────
 *
 * 单词和拼音的难度几乎就是"要连打几个键"，所以档位直接从**字符长度**算，
 * 不在数据里手写 tier 字段——手写的标注一旦和实际长度对不上，
 * 就是一个不会报错的隐性 bug。这里只有一份扁平词表，分桶在 wordPool() /
 * hanziPool() 里按长度做，规则只有一个地方可查。
 *
 * ── 汉字拼音标注约定 ─────────────────────────────────────────────────
 *
 * 拼音用**标准全拼小写**，ü 一律写成 v（女 nv、绿 lv），因为这是中文输入法
 * 实际要敲的键，玩家要按的就是这些字母。不标声调——练习的是指法不是拼音。
 *
 * @license MIT
 */

/**
 * 26 个英文字母，**按英文词频从高到低**排列。
 * 低难度档只取前 N 个（见 difficulty.js 的 letters 字段），
 * 这样入门玩家先练的是 e/t/a/o/i/n 这些最高频的键，而不是一上来就碰 q/z。
 */
export const LETTERS = 'etaoinshrdlucmfwygpbvkxjqz'.split('');

/**
 * 英文单词表（小写）。这是一份**扁平词表，故意不标档位**——
 * 分档在 wordPool() 里按字符长度现算（见文件头的说明），
 * 所以下面的段落分隔只是"写到哪儿了"的阅读锚点，不是难度分组。
 */
export const WORDS = [
  // ── 短词（3~4 字符，低档主力）──────────────────────────────────────
  'age', 'air', 'arm', 'back', 'ball', 'band', 'bank', 'bird', 'blue', 'boat',
  'body', 'book', 'box', 'cake', 'card', 'care', 'case', 'cat', 'city', 'code',
  'cold', 'come', 'cool', 'copy', 'dark', 'data', 'date', 'desk', 'dog', 'door',
  'down', 'draw', 'drop', 'east', 'easy', 'edge', 'face', 'fact', 'fall', 'farm',
  'fast', 'file', 'find', 'fire', 'fish', 'five', 'food', 'form', 'free', 'game',
  'gate', 'gift', 'girl', 'give', 'gold', 'good', 'grow', 'hair', 'half', 'hand',
  'hard', 'head', 'help', 'here', 'hero', 'high', 'hill', 'hold', 'home', 'hope',
  'hour', 'idea', 'join', 'jump', 'keep', 'key', 'kind', 'king', 'know', 'lake',
  'land', 'last', 'late', 'leaf', 'left', 'life', 'light', 'like', 'line', 'link',
  'list', 'long', 'look', 'love', 'luck', 'main', 'make', 'many', 'map', 'mark',
  'mind', 'moon', 'more', 'most', 'move', 'music', 'name', 'near', 'need', 'news',
  'next', 'nice', 'note', 'open', 'page', 'park', 'part', 'pass', 'past', 'path',
  'pick', 'plan', 'play', 'plot', 'poem', 'port', 'pull', 'push', 'rain', 'read',
  'real', 'rest', 'rice', 'rich', 'ride', 'ring', 'rise', 'road', 'rock', 'role',
  'room', 'rule', 'safe', 'salt', 'same', 'save', 'seat', 'seed', 'send', 'ship',
  'shop', 'show', 'side', 'sign', 'sing', 'site', 'size', 'skin', 'slow', 'snow',
  'soft', 'song', 'sort', 'star', 'stay', 'step', 'stop', 'story', 'sun', 'swim',
  'tail', 'take', 'talk', 'tall', 'task', 'team', 'tell', 'test', 'text', 'thin',
  'time', 'tiny', 'tone', 'tool', 'top', 'town', 'tree', 'trip', 'true', 'turn',
  'type', 'unit', 'user', 'view', 'walk', 'wall', 'warm', 'wash', 'wave', 'weak',
  'wear', 'week', 'well', 'west', 'wide', 'wild', 'wind', 'wine', 'wing', 'wire',
  'wise', 'wish', 'word', 'work', 'yard', 'year', 'zero', 'zone',

  // ── 长词区（这里开始以 5 字符以上的词为主，一路混到 11 字符）────────
  'about', 'above', 'across', 'action', 'active', 'actual', 'advice', 'afraid',
  'again', 'agree', 'ahead', 'allow', 'almost', 'alone', 'along', 'already',
  'always', 'amount', 'animal', 'answer', 'anyone', 'appeal', 'apple', 'around',
  'arrive', 'artist', 'aspect', 'attack', 'author', 'autumn', 'avoid', 'away',
  'balance', 'banana', 'battle', 'beach', 'beauty', 'because', 'become', 'before',
  'begin', 'behind', 'believe', 'below', 'benefit', 'beside', 'better', 'between',
  'beyond', 'bicycle', 'bigger', 'bitter', 'black', 'blank', 'block', 'blood',
  'board', 'boil', 'border', 'borrow', 'bother', 'bottle', 'bottom', 'brain',
  'branch', 'brave', 'bread', 'break', 'breath', 'bridge', 'bright', 'bring',
  'broad', 'broken', 'brother', 'brown', 'brush', 'build', 'bundle', 'burden',
  'burn', 'busy', 'butter', 'button', 'camera', 'candle', 'candy', 'carbon',
  'career', 'careful', 'carry', 'catch', 'cause', 'center', 'century', 'certain',
  'chance', 'change', 'charge', 'cheap', 'check', 'cheese', 'cherry', 'chest',
  'chicken', 'choice', 'choose', 'church', 'circle', 'claim', 'class', 'clean',
  'clear', 'clever', 'climb', 'clock', 'close', 'cloth', 'cloud', 'coach',
  'coast', 'coffee', 'collect', 'college', 'color', 'column', 'combine', 'common',
  'company', 'compare', 'complete', 'complex', 'concept', 'concern', 'concert',
  'condition', 'confirm', 'connect', 'consider', 'contact', 'contain', 'content',
  'contest', 'context', 'continue', 'control', 'convert', 'cook', 'corner',
  'correct', 'cost', 'cotton', 'count', 'country', 'couple', 'course', 'cover',
  'create', 'credit', 'crime', 'cross', 'crowd', 'crown', 'culture', 'curious',
  'current', 'custom', 'cycle', 'damage', 'danger', 'dealer', 'debate', 'decade',
  'decide', 'declare', 'decline', 'deep', 'defeat', 'defend', 'define', 'degree',
  'delay', 'deliver', 'demand', 'deny', 'depend', 'depth', 'desert', 'design',
  'desire', 'detail', 'detect', 'develop', 'device', 'differ', 'dinner', 'direct',
  'discuss', 'disease', 'display', 'distant', 'divide', 'double', 'doubt',
  'draft', 'dream', 'dress', 'drink', 'drive', 'during', 'duty', 'eager',
  'early', 'earth', 'easily', 'economy', 'effect', 'effort', 'eight', 'either',
  'elect', 'element', 'else', 'emerge', 'emotion', 'employ', 'enable', 'ending',
  'energy', 'engage', 'engine', 'enjoy', 'enough', 'ensure', 'enter', 'entire',
  'equal', 'escape', 'essay', 'estate', 'evening', 'event', 'every', 'evolve',
  'exact', 'examine', 'example', 'except', 'exchange', 'excuse', 'exist', 'expand',
  'expect', 'expert', 'explain', 'explore', 'export', 'expose', 'express',
  'extend', 'extent', 'factor', 'fairly', 'family', 'famous', 'farmer', 'fashion',
  'father', 'fault', 'favor', 'feature', 'federal', 'feeling', 'fellow', 'female',
  'fence', 'festival', 'fever', 'field', 'figure', 'filter', 'final', 'finance',
  'finger', 'finish', 'firmly', 'fiscal', 'flavor', 'flight', 'float', 'flower',
  'focus', 'follow', 'forest', 'forget', 'formal', 'former', 'forth', 'fortune',
  'forward', 'found', 'frame', 'fresh', 'friend', 'front', 'fruit', 'fully',
  'future', 'gallery', 'garden', 'gather', 'general', 'gentle', 'genuine',
  'glance', 'global', 'govern', 'grade', 'grain', 'grand', 'grant', 'grass',
  'great', 'green', 'ground', 'group', 'growth', 'guard', 'guess', 'guest',
  'guide', 'habit', 'handle', 'happen', 'happy', 'hardly', 'health', 'heart',
  'heavy', 'height', 'hidden', 'hobby', 'holder', 'holiday', 'honest', 'honor',
  'horse', 'hospital', 'hotel', 'house', 'however', 'human', 'humor', 'hungry',
  'hurry', 'husband', 'identify', 'image', 'impact', 'import', 'impose',
  'improve', 'incident', 'income', 'increase', 'indeed', 'index', 'indicate',
  'industry', 'inform', 'initial', 'injury', 'inner', 'insect', 'inside',
  'insight', 'install', 'instant', 'instead', 'intend', 'interest', 'internal',
  'internet', 'introduce', 'invest', 'invite', 'island', 'issue', 'item',
  'jacket', 'journey', 'judge', 'junior', 'keeper', 'kettle', 'kitten',
  'knife', 'knight', 'knowledge', 'label', 'labor', 'ladder', 'lady', 'launch',
  'lawyer', 'laugh', 'layer', 'leader', 'league', 'learn', 'least', 'leather',
  'leave', 'lecture', 'legal', 'legend', 'lemon', 'lend', 'length', 'lesson',
  'letter', 'level', 'library', 'license', 'limit', 'liquid', 'listen',
  'little', 'lively', 'local', 'locate', 'logic', 'lonely', 'loose', 'loser',
  'lucky', 'lunch', 'machine', 'magic', 'magnet', 'maintain', 'major', 'manage',
  'manner', 'march', 'margin', 'marine', 'market', 'marry', 'master', 'match',
  'material', 'matter', 'maybe', 'meaning', 'measure', 'media', 'medical',
  'medium', 'meeting', 'member', 'memory', 'mention', 'merely', 'message',
  'metal', 'method', 'middle', 'might', 'military', 'mineral', 'minute',
  'mirror', 'mission', 'mixture', 'mobile', 'modern', 'modest', 'moment',
  'money', 'monitor', 'month', 'moral', 'morning', 'mother', 'motion',
  'motor', 'mountain', 'mouse', 'mouth', 'movie', 'murder', 'muscle', 'museum',
  'mutual', 'mystery', 'narrow', 'nation', 'native', 'natural', 'nature',
  'nearly', 'neck', 'needle', 'negative', 'neighbor', 'neither', 'nervous',
  'network', 'neutral', 'never', 'newly', 'noble', 'nobody', 'noise',
  'normal', 'northern', 'nothing', 'notice', 'notion', 'novel', 'number',
  'nurse', 'object', 'observe', 'obtain', 'obvious', 'occasion', 'occupy',
  'occur', 'ocean', 'offer', 'office', 'offset', 'often', 'onion', 'online',
  'opera', 'opinion', 'oppose', 'option', 'orange', 'order', 'ordinary',
  'organ', 'origin', 'other', 'otherwise', 'ought', 'outcome', 'outline',
  'output', 'outside', 'owner', 'oxygen', 'package', 'paint', 'panel', 'paper',
  'parent', 'partly', 'partner', 'party', 'passage', 'patient', 'pattern',
  'pause', 'pay', 'peace', 'pencil', 'people', 'pepper', 'perfect', 'perform',
  'perhaps', 'period', 'permit', 'person', 'phrase', 'physical', 'piano',
  'picture', 'piece', 'pilot', 'pitch', 'place', 'plain', 'plane', 'planet',
  'plant', 'plastic', 'plate', 'platform', 'pleasant', 'please', 'pleasure',
  'plenty', 'pocket', 'poetry', 'point', 'police', 'policy', 'political',
  'politician', 'popular', 'population', 'portion', 'position', 'positive',
  'possible', 'post', 'potato', 'potential', 'pound', 'poverty', 'powerful',
  'practical', 'precise', 'predict', 'prefer', 'prepare', 'present', 'preserve',
  'president', 'press', 'pressure', 'prevent', 'previous', 'price', 'pride',
  'primary', 'principle', 'print', 'prior', 'private', 'prize', 'probably',
  'problem', 'proceed', 'process', 'produce', 'product', 'profile', 'profit',
  'program', 'progress', 'project', 'promise', 'promote', 'proof', 'proper',
  'proposal', 'propose', 'protect', 'protest', 'proud', 'provide', 'public',
  'publish', 'purpose', 'pursue', 'puzzle', 'quality', 'quarter', 'quiet',
  'quite', 'quote', 'rabbit', 'radar', 'radio', 'random', 'range', 'rapid',
  'rather', 'rating', 'reach', 'react', 'reader', 'ready', 'reason', 'recall',
  'recent', 'recipe', 'record', 'recover', 'reduce', 'refer', 'reflect',
  'reform', 'refuse', 'regard', 'region', 'regret', 'regular', 'reject',
  'relate', 'relax', 'release', 'relief', 'rely', 'remain', 'remark',
  'remedy', 'remind', 'remote', 'remove', 'render', 'repeat', 'replace',
  'report', 'request', 'require', 'rescue', 'research', 'reserve', 'resist',
  'resolve', 'resource', 'respect', 'respond', 'response', 'restore', 'result',
  'retail', 'retain', 'retire', 'return', 'reveal', 'review', 'revise',
  'reward', 'rhythm', 'ribbon', 'rid', 'rider', 'rifle', 'right', 'rigid',
  'rocket', 'romantic', 'rough', 'round', 'route', 'routine', 'royal',
  'rubber', 'ruin', 'ruler', 'rumor', 'rural', 'safety', 'salary', 'sample',
  'sand', 'satellite', 'satisfy', 'sauce', 'scale', 'scatter', 'scene',
  'schedule', 'scheme', 'scholar', 'school', 'science', 'scope', 'score',
  'screen', 'script', 'search', 'season', 'second', 'secret', 'section',
  'sector', 'secure', 'seek', 'seem', 'select', 'senior', 'sense', 'sentence',
  'separate', 'series', 'serious', 'serve', 'service', 'session', 'settle',
  'several', 'severe', 'shadow', 'shake', 'shall', 'shape', 'share', 'sharp',
  'sheet', 'shelf', 'shell', 'shift', 'shine', 'shirt', 'shock', 'shoot',
  'shore', 'short', 'should', 'shoulder', 'shout', 'silence', 'silent',
  'silver', 'similar', 'simple', 'simply', 'single', 'sister', 'situation',
  'skill', 'sleep', 'slice', 'slide', 'slight', 'smooth', 'soccer', 'social',
  'society', 'solid', 'solve', 'somebody', 'someday', 'somehow', 'someone',
  'something', 'sometime', 'somewhat', 'somewhere', 'sorry', 'source',
  'southern', 'space', 'speak', 'special', 'species', 'specific', 'speech',
  'speed', 'spend', 'spirit', 'spite', 'split', 'spoken', 'sport', 'spread',
  'spring', 'square', 'stable', 'staff', 'stage', 'stair', 'stamp', 'stand',
  'standard', 'stare', 'start', 'state', 'statement', 'station', 'status',
  'steady', 'steam', 'steel', 'stick', 'still', 'stomach', 'stone', 'storage',
  'store', 'storm', 'straight', 'strain', 'strange', 'stranger', 'strategy',
  'stream', 'street', 'stress', 'stretch', 'strike', 'string', 'strip',
  'stroke', 'strong', 'structure', 'struggle', 'student', 'studio', 'study',
  'stuff', 'stupid', 'style', 'subject', 'submit', 'succeed', 'success',
  'sudden', 'suffer', 'sugar', 'suggest', 'suit', 'summer', 'summit',
  'sunny', 'sunset', 'super', 'supply', 'support', 'suppose', 'surface',
  'surgery', 'surprise', 'surround', 'survey', 'survive', 'suspect',
  'sustain', 'swear', 'sweep', 'sweet', 'swift', 'swing', 'switch', 'symbol',
  'system', 'tackle', 'tailor', 'talent', 'target', 'taste', 'taxi', 'teach',
  'teacher', 'tear', 'technique', 'telephone', 'television', 'temperature',
  'template', 'temporary', 'tendency', 'tender', 'tennis', 'tension',
  'terrible', 'territory', 'terror', 'thanks', 'theater', 'theory', 'therapy',
  'therefore', 'thick', 'thing', 'think', 'thirsty', 'though', 'thought',
  'thousand', 'thread', 'threat', 'threaten', 'throat', 'through',
  'throughout', 'throw', 'thumb', 'thunder', 'ticket', 'tiger', 'tight',
  'timber', 'timing', 'tissue', 'title', 'tobacco', 'today', 'together',
  'tomato', 'tomorrow', 'tonight', 'topic', 'total', 'touch', 'toward',
  'tower', 'trace', 'track', 'trade', 'tradition', 'traffic', 'train',
  'transfer', 'transform', 'translate', 'transport', 'travel', 'treasure',
  'treat', 'treatment', 'treaty', 'tremble', 'trend', 'trial', 'tribe',
  'trick', 'trigger', 'trouble', 'truck', 'tunnel', 'turkey', 'twelve',
  'twenty', 'twice', 'typical', 'ugly', 'ultimate', 'uncle', 'uniform',
  'union', 'unique', 'united', 'universe', 'unknown', 'unless', 'unlike',
  'until', 'unusual', 'upstairs', 'urban', 'useful', 'useless', 'usual',
  'vacation', 'valley', 'valuable', 'value', 'variety', 'various', 'vegetable',
  'vehicle', 'venture', 'version', 'vertical', 'vessel', 'veteran', 'victim',
  'victory', 'video', 'village', 'violence', 'virtue', 'visible', 'vision',
  'visit', 'visual', 'vital', 'vivid', 'volume', 'volunteer', 'vote',
  'wage', 'wagon', 'wander', 'warmth', 'warn', 'warrior', 'waste', 'watch',
  'water', 'wealth', 'weapon', 'weather', 'wedding', 'weekend', 'welcome',
  'welfare', 'western', 'whatever', 'whenever', 'whereas', 'wherever',
  'whether', 'whisper', 'whistle', 'whole', 'whom', 'whose', 'widely',
  'wildlife', 'willing', 'window', 'winner', 'winter', 'wisdom', 'withdraw',
  'within', 'without', 'witness', 'wonder', 'wooden', 'worker', 'workshop',
  'worry', 'worth', 'wound', 'wrist', 'writer', 'writing', 'wrong', 'yellow',
  'yesterday', 'young', 'youth'
];

/**
 * 常用汉字 + 全拼（小写，ü 写作 v）。
 * 按拼音长度分档：tier 0 → ≤2，tier 1 → 3，tier 2 → 4，tier 3 → ≥5。
 */
export const HANZI = [
  { c: '的', p: 'de' }, { c: '一', p: 'yi' }, { c: '是', p: 'shi' }, { c: '不', p: 'bu' },
  { c: '了', p: 'le' }, { c: '在', p: 'zai' }, { c: '人', p: 'ren' }, { c: '有', p: 'you' },
  { c: '我', p: 'wo' }, { c: '他', p: 'ta' }, { c: '这', p: 'zhe' }, { c: '个', p: 'ge' },
  { c: '们', p: 'men' }, { c: '中', p: 'zhong' }, { c: '来', p: 'lai' }, { c: '上', p: 'shang' },
  { c: '大', p: 'da' }, { c: '为', p: 'wei' }, { c: '和', p: 'he' }, { c: '国', p: 'guo' },
  { c: '地', p: 'di' }, { c: '到', p: 'dao' }, { c: '以', p: 'yi' }, { c: '说', p: 'shuo' },
  { c: '时', p: 'shi' }, { c: '要', p: 'yao' }, { c: '就', p: 'jiu' }, { c: '出', p: 'chu' },
  { c: '会', p: 'hui' }, { c: '可', p: 'ke' }, { c: '也', p: 'ye' }, { c: '你', p: 'ni' },
  { c: '对', p: 'dui' }, { c: '生', p: 'sheng' }, { c: '能', p: 'neng' }, { c: '而', p: 'er' },
  { c: '子', p: 'zi' }, { c: '那', p: 'na' }, { c: '得', p: 'de' }, { c: '于', p: 'yu' },
  { c: '着', p: 'zhe' }, { c: '下', p: 'xia' }, { c: '自', p: 'zi' }, { c: '之', p: 'zhi' },
  { c: '年', p: 'nian' }, { c: '过', p: 'guo' }, { c: '发', p: 'fa' }, { c: '后', p: 'hou' },
  { c: '作', p: 'zuo' }, { c: '里', p: 'li' }, { c: '用', p: 'yong' }, { c: '道', p: 'dao' },
  { c: '行', p: 'xing' }, { c: '所', p: 'suo' }, { c: '然', p: 'ran' }, { c: '家', p: 'jia' },
  { c: '种', p: 'zhong' }, { c: '事', p: 'shi' }, { c: '成', p: 'cheng' }, { c: '方', p: 'fang' },
  { c: '多', p: 'duo' }, { c: '经', p: 'jing' }, { c: '么', p: 'me' }, { c: '去', p: 'qu' },
  { c: '法', p: 'fa' }, { c: '学', p: 'xue' }, { c: '如', p: 'ru' }, { c: '都', p: 'dou' },
  { c: '同', p: 'tong' }, { c: '现', p: 'xian' }, { c: '当', p: 'dang' }, { c: '没', p: 'mei' },
  { c: '动', p: 'dong' }, { c: '面', p: 'mian' }, { c: '起', p: 'qi' }, { c: '看', p: 'kan' },
  { c: '定', p: 'ding' }, { c: '天', p: 'tian' }, { c: '分', p: 'fen' }, { c: '还', p: 'hai' },
  { c: '进', p: 'jin' }, { c: '好', p: 'hao' }, { c: '小', p: 'xiao' }, { c: '部', p: 'bu' },
  { c: '其', p: 'qi' }, { c: '些', p: 'xie' }, { c: '主', p: 'zhu' }, { c: '样', p: 'yang' },
  { c: '理', p: 'li' }, { c: '心', p: 'xin' }, { c: '她', p: 'ta' }, { c: '本', p: 'ben' },
  { c: '前', p: 'qian' }, { c: '开', p: 'kai' }, { c: '但', p: 'dan' }, { c: '因', p: 'yin' },
  { c: '只', p: 'zhi' }, { c: '从', p: 'cong' }, { c: '想', p: 'xiang' }, { c: '实', p: 'shi' },
  { c: '日', p: 'ri' }, { c: '军', p: 'jun' }, { c: '者', p: 'zhe' }, { c: '意', p: 'yi' },
  { c: '无', p: 'wu' }, { c: '力', p: 'li' }, { c: '它', p: 'ta' }, { c: '与', p: 'yu' },
  { c: '长', p: 'chang' }, { c: '把', p: 'ba' }, { c: '机', p: 'ji' }, { c: '十', p: 'shi' },
  { c: '民', p: 'min' }, { c: '第', p: 'di' }, { c: '公', p: 'gong' }, { c: '此', p: 'ci' },
  { c: '已', p: 'yi' }, { c: '工', p: 'gong' }, { c: '使', p: 'shi' }, { c: '情', p: 'qing' },
  { c: '明', p: 'ming' }, { c: '性', p: 'xing' }, { c: '知', p: 'zhi' }, { c: '全', p: 'quan' },
  { c: '三', p: 'san' }, { c: '又', p: 'you' }, { c: '关', p: 'guan' }, { c: '点', p: 'dian' },
  { c: '正', p: 'zheng' }, { c: '业', p: 'ye' }, { c: '外', p: 'wai' }, { c: '将', p: 'jiang' },
  { c: '两', p: 'liang' }, { c: '高', p: 'gao' }, { c: '间', p: 'jian' }, { c: '由', p: 'you' },
  { c: '问', p: 'wen' }, { c: '很', p: 'hen' }, { c: '最', p: 'zui' }, { c: '重', p: 'zhong' },
  { c: '并', p: 'bing' }, { c: '物', p: 'wu' }, { c: '手', p: 'shou' }, { c: '应', p: 'ying' },
  { c: '战', p: 'zhan' }, { c: '向', p: 'xiang' }, { c: '头', p: 'tou' }, { c: '文', p: 'wen' },
  { c: '体', p: 'ti' }, { c: '政', p: 'zheng' }, { c: '美', p: 'mei' }, { c: '相', p: 'xiang' },
  { c: '见', p: 'jian' }, { c: '被', p: 'bei' }, { c: '利', p: 'li' }, { c: '什', p: 'shen' },
  { c: '二', p: 'er' }, { c: '等', p: 'deng' }, { c: '产', p: 'chan' }, { c: '或', p: 'huo' },
  { c: '新', p: 'xin' }, { c: '己', p: 'ji' }, { c: '制', p: 'zhi' }, { c: '身', p: 'shen' },
  { c: '果', p: 'guo' }, { c: '加', p: 'jia' }, { c: '西', p: 'xi' }, { c: '斯', p: 'si' },
  { c: '月', p: 'yue' }, { c: '话', p: 'hua' }, { c: '合', p: 'he' }, { c: '回', p: 'hui' },
  { c: '特', p: 'te' }, { c: '代', p: 'dai' }, { c: '内', p: 'nei' }, { c: '信', p: 'xin' },
  { c: '表', p: 'biao' }, { c: '化', p: 'hua' }, { c: '老', p: 'lao' }, { c: '给', p: 'gei' },
  { c: '世', p: 'shi' }, { c: '位', p: 'wei' }, { c: '次', p: 'ci' }, { c: '度', p: 'du' },
  { c: '门', p: 'men' }, { c: '任', p: 'ren' }, { c: '常', p: 'chang' }, { c: '先', p: 'xian' },
  { c: '海', p: 'hai' }, { c: '通', p: 'tong' }, { c: '教', p: 'jiao' }, { c: '儿', p: 'er' },
  { c: '原', p: 'yuan' }, { c: '东', p: 'dong' }, { c: '声', p: 'sheng' }, { c: '提', p: 'ti' },
  { c: '立', p: 'li' }, { c: '及', p: 'ji' }, { c: '比', p: 'bi' }, { c: '员', p: 'yuan' },
  { c: '解', p: 'jie' }, { c: '水', p: 'shui' }, { c: '名', p: 'ming' }, { c: '真', p: 'zhen' },
  { c: '论', p: 'lun' }, { c: '处', p: 'chu' }, { c: '走', p: 'zou' }, { c: '义', p: 'yi' },
  { c: '各', p: 'ge' }, { c: '入', p: 'ru' }, { c: '几', p: 'ji' }, { c: '口', p: 'kou' },
  { c: '认', p: 'ren' }, { c: '条', p: 'tiao' }, { c: '平', p: 'ping' }, { c: '系', p: 'xi' },
  { c: '气', p: 'qi' }, { c: '题', p: 'ti' }, { c: '活', p: 'huo' }, { c: '尔', p: 'er' },
  { c: '更', p: 'geng' }, { c: '别', p: 'bie' }, { c: '打', p: 'da' }, { c: '女', p: 'nv' },
  { c: '变', p: 'bian' }, { c: '四', p: 'si' }, { c: '神', p: 'shen' }, { c: '总', p: 'zong' },
  { c: '字', p: 'zi' }, { c: '朋', p: 'peng' }, { c: '友', p: 'you' },
  { c: '习', p: 'xi' }, { c: '键', p: 'jian' }, { c: '盘', p: 'pan' }, { c: '练', p: 'lian' },
  { c: '窗', p: 'chuang' }, { c: '双', p: 'shuang' }, { c: '床', p: 'chuang' }, { c: '装', p: 'zhuang' },
  { c: '光', p: 'guang' }, { c: '黄', p: 'huang' }, { c: '凉', p: 'liang' }, { c: '晴', p: 'qing' },
  { c: '强', p: 'qiang' }, { c: '场', p: 'chang' }, { c: '厂', p: 'chang' }, { c: '唱', p: 'chang' },
  { c: '树', p: 'shu' }, { c: '书', p: 'shu' }, { c: '数', p: 'shu' }, { c: '输', p: 'shu' },
  { c: '快', p: 'kuai' }, { c: '慢', p: 'man' }, { c: '准', p: 'zhun' }, { c: '确', p: 'que' },
  { c: '速', p: 'su' }, { c: '记', p: 'ji' }, { c: '录', p: 'lu' }, { c: '绩', p: 'ji' },
  { c: '玩', p: 'wan' }, { c: '游', p: 'you' }, { c: '戏', p: 'xi' }, { c: '球', p: 'qiu' },
  { c: '鸟', p: 'niao' }, { c: '啄', p: 'zhuo' }, { c: '破', p: 'po' }, { c: '风', p: 'feng' },
  { c: '云', p: 'yun' }, { c: '雨', p: 'yu' }, { c: '雪', p: 'xue' }, { c: '花', p: 'hua' },
  { c: '草', p: 'cao' }, { c: '木', p: 'mu' }, { c: '山', p: 'shan' }, { c: '河', p: 'he' }
];

/** 词长分档的边界：tier → [最短, 最长]（最长可为 Infinity） */
const WORD_TIER_RANGE = [
  [3, 4],
  [5, 6],
  [7, 8],
  [9, Infinity]
];

/** 拼音长度分档的边界：tier → [最短, 最长] */
const HANZI_TIER_RANGE = [
  [0, 2],
  [3, 3],
  [4, 4],
  [5, Infinity]
];

/**
 * 按档位取一组长度合适的英文单词。
 * 档位越界会被夹到有效范围；某档一个词都没有时向相邻档借，
 * 保证返回的数组永远非空（上层不用做空判断）。
 *
 * @param {number} tier 0～3
 * @returns {string[]} 小写单词数组
 */
export function wordPool(tier) {
  return bucket(WORDS, WORD_TIER_RANGE, tier, (w) => w.length);
}

/**
 * 按档位取一组拼音长度合适的汉字条目。
 *
 * @param {number} tier 0～3
 * @returns {{c: string, p: string}[]} 汉字 + 全拼
 */
export function hanziPool(tier) {
  return bucket(HANZI, HANZI_TIER_RANGE, tier, (h) => h.p.length);
}

/**
 * 通用分桶：先取目标档，空了就向左右扩散着找，找到就返回。
 * @param {Array} list 扁平表
 * @param {Array<[number, number]>} ranges 每档的长度区间
 * @param {number} tier 目标档
 * @param {(item: any) => number} sizeOf 取长度
 * @returns {Array} 非空子集
 */
function bucket(list, ranges, tier, sizeOf) {
  const n = ranges.length;
  let idx = Math.round(Number(tier));
  if (!isFinite(idx)) idx = 0;
  idx = Math.max(0, Math.min(n - 1, idx));

  for (let radius = 0; radius < n; radius++) {
    for (const probe of [idx - radius, idx + radius]) {
      if (probe < 0 || probe >= n) continue;
      const [lo, hi] = ranges[probe];
      const hit = list.filter((item) => {
        const s = sizeOf(item);
        return s >= lo && s <= hi;
      });
      if (hit.length) return hit;
    }
  }
  return list.slice();
}

/** 字母模式在某档可用的字母（按词频）
 * @param {number} count 解锁多少个，1～26
 * @returns {string[]} 小写字母数组
 */
export function letterPool(count) {
  const n = Math.max(1, Math.min(LETTERS.length, Math.round(Number(count) || 1)));
  return LETTERS.slice(0, n);
}
