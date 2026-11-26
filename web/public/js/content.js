// Default content of the website. Everything here can be changed in the admin panel; the admin's
// saved version replaces this file's content for every visitor.
const t = (ar, en) => ({ ar, en });

// a simple illustrated cover for the example projects (an SVG, so the page has no external images)
const cover = (sky1, sky2, house) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".95"/><stop offset="1" stop-color="#ff9e45" stop-opacity=".7"/></linearGradient></defs><rect width="640" height="400" fill="url(#s)"/><rect y="300" width="640" height="100" fill="#20252c"/>${house}</svg>`);
const villa = cover('#1b2a44', '#3b4f72', '<rect x="140" y="170" width="360" height="140" fill="#e9e3d8"/><rect x="110" y="150" width="420" height="22" fill="#2b2f35"/><rect x="180" y="200" width="90" height="70" fill="url(#g)"/><rect x="300" y="200" width="60" height="110" fill="#4a3a2c"/><rect x="390" y="200" width="80" height="70" fill="url(#g)"/><rect x="0" y="300" width="640" height="6" fill="#ffd9a0" opacity=".5"/>');
const flat = cover('#0f1626', '#26334d', '<rect x="210" y="60" width="220" height="250" fill="#d9d4cb"/>' + [0, 1, 2, 3, 4].map(r => [0, 1, 2].map(c => `<rect x="${232 + c * 66}" y="${80 + r * 44}" width="42" height="28" fill="${(r + c) % 3 ? 'url(#g)' : '#36404f'}"/>`).join('')).join(''));
const office = cover('#203047', '#7d8ea6', '<rect x="90" y="140" width="460" height="170" fill="#cfd6df"/><rect x="90" y="140" width="460" height="10" fill="#2b2f35"/>' + [0, 1, 2, 3, 4, 5].map(c => `<rect x="${110 + c * 72}" y="170" width="56" height="110" fill="url(#g)" opacity=".85"/>`).join(''));

export const DEFAULT_CONTENT = {
  v: 1,
  brand: {
    name: 'DIGITAL HOME', tagline: t('الموزّع الحصري لأورفيبو', 'Exclusive ORVIBO distributor'), accent: '#c9a25a',
    phone: '', whatsapp: '', email: '', address: t('', ''), hours: t('', ''), instagram: '', facebook: '', simulatorUrl: '',
  },
  sections: [
    { id: 'about', on: true }, { id: 'orvibo', on: true }, { id: 'lighting', on: true }, { id: 'cri', on: true }, { id: 'mixpad', on: true }, { id: 'lock', on: true },
    { id: 'curtain', on: true }, { id: 'climate', on: true }, { id: 'remote', on: true }, { id: 'catalog', on: true }, { id: 'projects', on: true }, { id: 'contact', on: true },
  ],
  hero: {
    kicker: t('ديجيتال هوم · أورفيبو', 'DIGITAL HOME · ORVIBO'),
    title: t('بيتك أذكى، وحياتك أسهل', 'A smarter home, an easier life'),
    text: t('نحوّل البيت والمكتب إلى مساحة تفهمك: إضاءة تتبع مزاجك، ستائر تفتح مع الشمس، أمان يعمل وأنت بعيد، وكل ذلك من لوحة على الحائط أو من هاتفك.', 'We turn homes and offices into spaces that understand you: lighting that follows your mood, curtains that open with the sun, security that works while you are away — all from a wall panel or your phone.'),
    cta: t('شاهد المنتجات وهي تعمل', 'See the products in action'), cta2: t('تواصل معنا', 'Contact us'),
  },
  about: {
    title: t('من نحن', 'About Digital Home'),
    body: t('ديجيتال هوم شركة متخصصة في حلول المنزل الذكي، وهي الموزّع الحصري لمنتجات أورفيبو. نرافق العميل من الفكرة إلى ما بعد التسليم: ندرس المساحة واحتياجات العائلة، ونصمّم المنظومة، ونورّد الأجهزة الأصلية، ثم نركّبها ونبرمجها وندرّب أصحاب المكان على استخدامها.', 'Digital Home is a smart-home specialist and the exclusive distributor of ORVIBO. We stay with our clients from the first idea to well after handover: we study the space and the family’s needs, design the system, supply genuine devices, then install, program and train the owners to use it.'),
    points: [
      { icon: 'plan', title: t('الدراسة والتصميم', 'Survey & design'), text: t('نزور الموقع ونقترح منظومة تناسب المكان والميزانية.', 'We visit the site and propose a system that fits the space and the budget.') },
      { icon: 'box', title: t('توريد أصلي', 'Genuine supply'), text: t('أجهزة أورفيبو الأصلية بضمان الوكيل الحصري.', 'Genuine ORVIBO devices with the exclusive distributor’s warranty.') },
      { icon: 'tools', title: t('التركيب والبرمجة', 'Installation & programming'), text: t('فريق فني يركّب ويبرمج المشاهد والأتمتة حسب أسلوب حياتك.', 'Our technicians install and program scenes and automations around your routine.') },
      { icon: 'support', title: t('دعم بعد التسليم', 'Support after handover'), text: t('نبقى قريبين منك للصيانة والتطوير والإضافات.', 'We stay close for maintenance, upgrades and additions.') },
    ],
    stats: [],
  },
  orvibo: {
    title: t('لماذا أورفيبو؟', 'Why ORVIBO?'),
    body: t('أورفيبو علامة متخصصة في أنظمة المنزل الذكي المتكاملة. بدل أن يكون لكل جهاز تطبيق وريموت منفصل، تعمل الإضاءة والستائر والتكييف والأقفال والكاميرات والصوت كمنظومة واحدة تتفاهم أجهزتها فيما بينها، ويتحكم بها صاحب البيت من لوحة MixPad على الحائط أو من الهاتف أو بالصوت. وتعتمد معظم الأجهزة على شبكة Zigbee اللاسلكية منخفضة الاستهلاك، فيمكن تركيبها في بيت جديد أو قائم دون تكسير جدران.', 'ORVIBO specialises in complete smart-home systems. Instead of a separate app and remote for every device, lighting, curtains, climate, locks, cameras and audio work as one system whose devices talk to each other, controlled from a MixPad on the wall, a phone or by voice. Most devices use Zigbee, a low-power wireless network, so they fit new or existing homes without breaking walls.'),
    advantages: [
      { icon: 'grid', title: t('منظومة واحدة', 'One ecosystem'), text: t('تطبيق واحد ولوحة واحدة لكل أجهزة البيت.', 'One app and one panel for every device in the home.') },
      { icon: 'spark', title: t('مشاهد بلمسة', 'Scenes in one touch'), text: t('«وصلت البيت» أو «سهرة فيلم» تضبط الإضاءة والستائر والتكييف معاً.', '“Welcome home” or “Movie night” sets lights, curtains and climate together.') },
      { icon: 'wireless', title: t('تركيب بلا تكسير', 'No-demolition install'), text: t('شبكة لاسلكية منخفضة الاستهلاك تناسب البيوت القائمة.', 'A low-power wireless network that suits existing homes.') },
      { icon: 'shield', title: t('أمان متكامل', 'Built-in security'), text: t('أقفال وكاميرات وحساسات تعمل كنظام إنذار واحد.', 'Locks, cameras and sensors working as one alarm system.') },
      { icon: 'leaf', title: t('توفير الطاقة', 'Energy saving'), text: t('إطفاء الغرف الفارغة وإيقاف المكيّف عند فتح النافذة.', 'Empty rooms switch off and the AC pauses when a window opens.') },
      { icon: 'design', title: t('تصميم فاخر', 'Premium design'), text: t('لوحات ومفاتيح بتشطيبات تليق بالديكور.', 'Panels and switches in finishes that suit the interior.') },
    ],
    compareTitle: t('مقارنة مع الحلول الأخرى', 'Compared with other solutions'),
    compareNote: t('مقارنة عامة بين أنواع الحلول، وقد تختلف التفاصيل حسب المشروع.', 'A general comparison between kinds of solution; details vary by project.'),
    columns: [t('أورفيبو — منظومة متكاملة', 'ORVIBO — complete system'), t('أجهزة ذكية متفرقة', 'Separate smart gadgets'), t('أنظمة سلكية تقليدية', 'Traditional wired systems')],
    rows: [
      { label: t('التحكم', 'Control'), cells: [[3, t('تطبيق ولوحة حائط واحدة', 'One app and one wall panel')], [1, t('تطبيق مختلف لكل علامة', 'A different app per brand')], [2, t('لوحات خاصة وبرمجة من مختص', 'Dedicated panels, expert programming')]] },
      { label: t('التركيب', 'Installation'), cells: [[3, t('لاسلكي غالباً ويناسب البيوت القائمة', 'Mostly wireless, fits existing homes')], [2, t('سهل لكن الأجهزة غير مترابطة', 'Easy, but devices are not linked')], [1, t('تمديدات كثيرة، للبناء الجديد', 'Heavy cabling, for new builds')]] },
      { label: t('الأتمتة بين الأجهزة', 'Automation across devices'), cells: [[3, t('مشاهد تجمع كل الأجهزة', 'Scenes span every device')], [1, t('محدودة بين العلامات', 'Limited across brands')], [3, t('قوية لكن برمجتها مكلفة', 'Powerful but costly to program')]] },
      { label: t('الشبكة', 'Network'), cells: [[3, t('شبكة Zigbee خاصة منخفضة الاستهلاك', 'Dedicated low-power Zigbee mesh')], [1, t('كل جهاز يحمّل الراوتر', 'Every device loads the router')], [3, t('شبكة سلكية مستقلة', 'Separate wired bus')]] },
      { label: t('التصميم', 'Design'), cells: [[3, t('لوحات ومفاتيح بتشطيبات فاخرة', 'Panels and switches in premium finishes')], [1, t('متفاوت', 'Mixed')], [2, t('تقليدي غالباً', 'Mostly conventional')]] },
      { label: t('التكلفة', 'Cost'), cells: [[2, t('متوسطة مقابل حل متكامل', 'Moderate for a complete system')], [3, t('منخفضة للجهاز الواحد', 'Low per device')], [1, t('مرتفعة', 'High')]] },
    ],
  },
  blocks: {
    lighting: { title: t('مجموعة الإضاءة', 'The lighting collection'), sub: t('اختر قطعة من المجموعة وغيّر سطوعها ولونها، وشاهد الغرفة تتغيّر أمامك.', 'Pick a light from the collection, change its brightness and colour, and watch the room change.') },
    cri: { title: t('جودة اللون: الفرق تراه بعينك', 'Colour quality you can see'), sub: t('نفس الطاولة تحت نوعين من الإضاءة. اسحب الخط لترى كيف تُظهر إضاءة أورفيبو الألوان الحقيقية مقارنة بإضاءة عادية رخيصة.', 'The same table under two kinds of light. Drag the line to see how ORVIBO lighting shows true colours compared with an ordinary budget light.') },
    mixpad: { title: t('لوحات MixPad', 'MixPad panels'), sub: t('اللوحة على الحائط هي عقل البيت. جرّب الشاشة: كل ضغطة تتحكم بالغرفة المجاورة.', 'The panel on the wall is the brain of the home. Try the screen: every tap controls the room next to it.') },
    lock: { title: t('القفل الذكي', 'The smart lock'), sub: t('افتح الباب بالبصمة أو الوجه أو الرمز أو البطاقة، أو من الهاتف لزائر عند الباب.', 'Open with fingerprint, face, code or card — or from your phone for a visitor at the door.') },
    curtain: { title: t('الستائر الذكية', 'Smart curtains'), sub: t('محرك هادئ يفتح ويغلق بأي نسبة، ويتبع الشروق والغروب.', 'A quiet motor that opens to any position and follows sunrise and sunset.') },
    climate: { title: t('التكييف والتلفزيون', 'Climate & TV'), sub: t('شغّل المكيّف وغيّر الوضع والسرعة، وتحكّم بالتلفزيون من الريموت الذكي.', 'Run the AC, change mode and speed, and control the TV through the smart remote.') },
    remote: { title: t('التحكم من الهاتف', 'Control from your phone'), sub: t('البيت كله في جيبك: الإضاءة والستائر والتكييف والتلفزيون والمشاهد، من أي مكان.', 'The whole home in your pocket: lights, curtains, climate, TV and scenes, from anywhere.') },
    catalog: { title: t('منتجات أخرى', 'More products'), sub: t('حساسات وكاميرات ومفاتيح تكمل المنظومة.', 'Sensors, cameras and switches that complete the system.') },
    projects: { title: t('أعمالنا', 'Our work'), sub: t('أماكن نفّذت فيها ديجيتال هوم منظومة أورفيبو.', 'Places where Digital Home has installed ORVIBO.') },
    contact: { title: t('تواصل معنا', 'Contact us'), sub: t('أخبرنا عن مشروعك ونقترح عليك المنظومة المناسبة.', 'Tell us about your project and we will propose the right system.') },
  },
  cri: {
    ours: '95', oursLabel: t('إضاءة أورفيبو', 'ORVIBO lighting'), other: '80', otherLabel: t('إضاءة عادية رخيصة', 'Ordinary budget light'),
    points: [
      { title: t('ألوان حقيقية', 'True colours'), text: t('مؤشر تجسيد اللون (Ra) يقيس مدى قرب ألوان الأشياء تحت المصباح من ألوانها تحت ضوء الشمس. كلما اقترب من 100 بدت الألوان أصدق.', 'The colour rendering index (Ra) measures how close colours look under a lamp to how they look in daylight. The closer to 100, the truer the colours.') },
      { title: t('الأحمر والبشرة', 'Reds and skin tones'), text: t('الإضاءة الرخيصة تُفقد الأحمر عمقه فيبدو الطعام باهتاً والبشرة شاحبة.', 'Budget light drains the depth from reds, so food looks dull and skin looks pale.') },
      { title: t('بلا وميض', 'Flicker'), text: t('بعض المصابيح الرخيصة تومض بسرعة لا تراها العين لكنها تُتعب النظر وتظهر بوضوح في كاميرا الهاتف.', 'Some cheap lamps flicker too fast to see, yet it tires the eyes and shows clearly on a phone camera.') },
      { title: t('أبيض موحّد', 'Matching whites'), text: t('في الإضاءة الرخيصة قد يختلف لون الأبيض من مصباح لآخر في نفس السقف.', 'With cheap lighting the white can differ from one lamp to the next on the same ceiling.') },
    ],
    note: t('الصورة محاكاة توضيحية للفرق، والأرقام قيم نموذجية. تُرجى مراجعة مواصفات كل منتج.', 'The picture is an illustration of the difference and the figures are typical values. Check each product’s data sheet.'),
  },
  products: [
    { id: 'p_down', cat: 'lighting', fixture: 'down', on: true, name: t('سبوت لايت مدمج SOPRO', 'SOPRO recessed downlight'), desc: t('إضاءة عامة ناعمة من السقف، تتدرّج من خافتة إلى كاملة ومن الأبيض الدافئ إلى البارد.', 'Soft general light from the ceiling, dimming from a glow to full and from warm to cool white.'), specs: t('التعتيم: 1–100%\nلون الأبيض: 2700–6500 كلفن\nالتركيب: مدمج في السقف', 'Dimming: 1–100 %\nWhite: 2700–6500 K\nMounting: recessed ceiling'), img: '' },
    { id: 'p_spot', cat: 'lighting', fixture: 'spot', on: true, name: t('سبوت موجّه', 'Adjustable accent spot'), desc: t('حزمة ضيقة تُبرز اللوحات والقطع الفنية وتعطي المكان عمقاً.', 'A narrow beam that brings out artwork and gives the room depth.'), specs: t('زاوية ضيقة قابلة للتوجيه\nقابل للتعتيم وتغيير لون الأبيض', 'Narrow, adjustable beam\nDimmable, tunable white'), img: '' },
    { id: 'p_strip', cat: 'lighting', fixture: 'strip', on: true, name: t('الإضاءة المخفية (شادو لاين)', 'Shadow-line light strip'), desc: t('ضوء غير مباشر يخرج من فاصل السقف فيجعل السقف يبدو عائماً، بملايين الألوان.', 'Indirect light from the ceiling gap that makes the ceiling float, in millions of colours.'), specs: t('RGB + أبيض متدرّج\nمؤثرات ومشاهد ملوّنة', 'RGB + tunable white\nColour scenes and effects'), img: '' },
    { id: 'p_track', cat: 'lighting', fixture: 'track', on: true, name: t('التراك المغناطيسي', 'Magnetic track'), desc: t('سكة رفيعة تُثبت عليها وحدات الإضاءة مغناطيسياً وتنقلها متى شئت.', 'A slim rail where light modules attach magnetically and move whenever you like.'), specs: t('وحدات سبوت وخطية\nإعادة ترتيب دون تمديدات', 'Spot and linear modules\nRearrange without rewiring'), img: '' },
    { id: 'p_pendant', cat: 'lighting', fixture: 'pendant', on: true, name: t('إضاءة معلّقة', 'Pendant light'), desc: t('ضوء دافئ فوق ركن القراءة أو طاولة الطعام، يصنع جواً حميماً.', 'Warm light over a reading corner or dining table that creates an intimate mood.'), specs: t('قابلة للتعتيم\nأبيض دافئ', 'Dimmable\nWarm white'), img: '' },
    { id: 'p_washer', cat: 'lighting', fixture: 'washer', on: true, name: t('إضاءة غاسلة للجدار', 'Wall washer'), desc: t('تغسل الجدار المكسوّ بالخشب أو الحجر بضوء ناعم يُظهر ملمسه.', 'Washes a wood or stone feature wall in soft light that brings out its texture.'), specs: t('تركيب أرضي أو سقفي\nأبيض متدرّج أو ملوّن', 'Floor or ceiling mounted\nTunable white or colour'), img: '' },
    { id: 'p_mpx', cat: 'mixpad', model: 'x', on: true, name: t('MixPad X', 'MixPad X'), desc: t('لوحة أفقية كبيرة تعرض البيت كله: المشاهد والإضاءة والستائر والتكييف والكاميرات.', 'A large landscape panel showing the whole home: scenes, lights, curtains, climate and cameras.'), specs: t('شاشة لمس كبيرة\nبوابة للأجهزة مدمجة\nتحكم صوتي', 'Large touch screen\nBuilt-in device gateway\nVoice control'), img: '' },
    { id: 'p_mp7', cat: 'mixpad', model: '7', on: true, name: t('MixPad 7', 'MixPad 7'), desc: t('لوحة أنيقة متوسطة الحجم تناسب الصالة وغرفة النوم.', 'An elegant mid-size panel for the living room or bedroom.'), specs: t('شاشة لمس\nمشاهد وتحكم بالغرف', 'Touch screen\nScenes and room control'), img: '' },
    { id: 'p_mpmini', cat: 'mixpad', model: 'mini', on: true, name: t('MixPad Mini', 'MixPad Mini'), desc: t('لوحة مربعة صغيرة بحجم علبة المفتاح العادية.', 'A small square panel the size of a standard switch box.'), specs: t('مقاس علبة المفتاح\nتحكم بالإضاءة والمشاهد', 'Standard switch-box size\nLights and scenes'), img: '' },
    { id: 'p_lockf', cat: 'lock', model: 'face', on: true, name: t('القفل الذكي بالتعرّف على الوجه', 'Face-recognition smart lock'), desc: t('يفتح بالوجه أو البصمة أو الرمز أو البطاقة أو التطبيق، مع جرس فيديو.', 'Opens by face, fingerprint, code, card or the app, with a video doorbell.'), specs: t('وجه، بصمة، رمز، بطاقة، تطبيق\nسجل دخول وتنبيهات\nإنذار عند العبث', 'Face, fingerprint, code, card, app\nEntry history and alerts\nTamper alarm'), img: '' },
    { id: 'p_lockp', cat: 'lock', model: 'finger', on: true, name: t('القفل الذكي بالبصمة', 'Fingerprint smart lock'), desc: t('قفل أنيق بالبصمة والرمز والبطاقة، ورموز مؤقتة للزوار.', 'A sleek lock with fingerprint, code and card, plus one-time codes for visitors.'), specs: t('بصمة، رمز، بطاقة، تطبيق\nرموز مؤقتة للزوار', 'Fingerprint, code, card, app\nOne-time visitor codes'), img: '' },
    { id: 'p_curtain', cat: 'curtain', on: true, name: t('محرك الستائر الذكي', 'Smart curtain motor'), desc: t('يفتح ويغلق بأي نسبة بهدوء، ويبدأ بسحبة خفيفة باليد.', 'Opens and closes quietly to any position, and starts with a light pull by hand.'), specs: t('تحكم بالنسبة المئوية\nجدولة مع الشروق والغروب\nيعمل مع المشاهد', 'Percentage control\nSunrise and sunset schedules\nWorks with scenes'), img: '' },
    { id: 'p_ac', cat: 'climate', on: true, name: t('وحدة التحكم بالمكيّف', 'AC controller'), desc: t('تحكم بالمكيّفات المركزية والسبليت: الوضع ودرجة الحرارة وسرعة المروحة.', 'Controls central and split AC units: mode, temperature and fan speed.'), specs: t('تبريد، تدفئة، تجفيف، مروحة\nجدولة وتوفير طاقة', 'Cool, heat, dry, fan\nSchedules and energy saving'), img: '' },
    { id: 'p_ir', cat: 'climate', on: true, name: t('الريموت الذكي (أشعة تحت حمراء)', 'Smart IR remote'), desc: t('يحوّل التلفزيون والمكيّف وأي جهاز بريموت إلى جهاز ذكي.', 'Turns the TV, the AC and anything with a remote into a smart device.'), specs: t('يتعلّم أوامر الريموت\nيدخل في المشاهد', 'Learns remote commands\nJoins scenes'), img: '' },
    { id: 'p_app', cat: 'remote', on: true, name: t('تطبيق أورفيبو هوم', 'ORVIBO Home app'), desc: t('تحكم بكل البيت من أي مكان، وتلقَّ التنبيهات فوراً.', 'Control the whole home from anywhere and get alerts instantly.'), specs: t('iOS و Android\nمشاهد وأتمتة\nتنبيهات فورية', 'iOS and Android\nScenes and automation\nInstant alerts'), img: '' },
    { id: 'p_switch', cat: 'other', icon: 'switch', on: true, name: t('مفاتيح MixSwitch', 'MixSwitch switches'), desc: t('شكل المفتاح الأنيق، وكل زر يتحكم بمصباح أو مجموعة أو مشهد.', 'A premium switch where each key drives a lamp, a group or a scene.'), specs: t('1 أو 2 أو 3 أزرار\nأزرار مشاهد', '1, 2 or 3 keys\nScene keys'), img: '' },
    { id: 'p_presence', cat: 'other', icon: 'presence', on: true, name: t('حساس الحضور', 'Presence sensor'), desc: t('يعرف أن في الغرفة أحداً حتى لو كان جالساً بلا حركة.', 'Knows someone is in the room even when they sit still.'), specs: t('كشف حضور دقيق\nإضاءة وتكييف تلقائي', 'Accurate presence detection\nAutomatic lights and climate'), img: '' },
    { id: 'p_th', cat: 'other', icon: 'thermo', on: true, name: t('حساس الحرارة والرطوبة', 'Temperature & humidity sensor'), desc: t('يقيس الحرارة والرطوبة ويشغّل التكييف والتهوية تلقائياً.', 'Measures temperature and humidity and runs climate and ventilation automatically.'), specs: t('حرارة ورطوبة\nيعمل بالبطارية', 'Temperature and humidity\nBattery powered'), img: '' },
    { id: 'p_contact', cat: 'other', icon: 'contact', on: true, name: t('حساس الأبواب والنوافذ', 'Door & window sensor'), desc: t('ينبّهك فور فتح باب أو نافذة، وهو أساس الإنذار.', 'Alerts you the moment a door or window opens — the base of the alarm.'), specs: t('فتح وإغلاق\nإنذار وتوفير طاقة', 'Open / closed\nAlarm and energy saving'), img: '' },
    { id: 'p_safety', cat: 'other', icon: 'flame', on: true, name: t('حساسات الدخان والغاز والتسرّب', 'Smoke, gas & leak sensors'), desc: t('تكشف الخطر مبكراً وتغلق الصمامات وترسل تنبيهاً.', 'Detect danger early, shut the valves and send an alert.'), specs: t('دخان، غاز، ماء\nإغلاق صمامات تلقائي', 'Smoke, gas, water\nAutomatic valve shut-off'), img: '' },
    { id: 'p_cam', cat: 'other', icon: 'camera', on: true, name: t('الكاميرات الذكية', 'Smart cameras'), desc: t('بث مباشر وتسجيل تلقائي عند الإنذار ووضع خصوصية.', 'Live view, automatic recording on alarm and a privacy mode.'), specs: t('بث مباشر\nرؤية ليلية\nوضع خصوصية', 'Live view\nNight vision\nPrivacy mode'), img: '' },
    { id: 'p_sos', cat: 'other', icon: 'sos', on: true, name: t('زر الطوارئ', 'Emergency button'), desc: t('ضغطة واحدة تنبّه العائلة وتضيء البيت.', 'One press alerts the family and lights up the home.'), specs: t('تنبيه فوري\nمناسب لكبار السن', 'Instant alert\nIdeal for the elderly'), img: '' },
  ],
  projects: [
    { id: 'pr1', sample: true, on: true, title: t('فيلا سكنية — مثال', 'Family villa — example'), place: t('المدينة', 'City'), type: t('فيلا', 'Villa'), year: '2025', desc: t('مشروع توضيحي: استبدله بأعمالك من لوحة الإدارة. إضاءة كاملة بمشاهد، ستائر ذكية، أقفال وكاميرات، ولوحات MixPad في الطوابق.', 'Example project — replace it with your own work in the admin panel. Full scene lighting, smart curtains, locks and cameras, and MixPad panels on every floor.'), devices: t('MixPad X، إضاءة SOPRO، محركات ستائر، قفل ذكي، كاميرات', 'MixPad X, SOPRO lighting, curtain motors, smart lock, cameras'), images: [villa] },
    { id: 'pr2', sample: true, on: true, title: t('شقة حديثة — مثال', 'Modern apartment — example'), place: t('المدينة', 'City'), type: t('شقة', 'Apartment'), year: '2025', desc: t('مشروع توضيحي: شقة بتحكم كامل من الهاتف وإضاءة مخفية ملوّنة وحساسات حضور.', 'Example project: an apartment fully controlled from the phone, with colour strips and presence sensors.'), devices: t('MixPad 7، شادو لاين، حساسات حضور، ريموت ذكي', 'MixPad 7, shadow-line strips, presence sensors, smart remote'), images: [flat] },
    { id: 'pr3', sample: true, on: true, title: t('مكتب إداري — مثال', 'Office — example'), place: t('المدينة', 'City'), type: t('مكتب', 'Office'), year: '2024', desc: t('مشروع توضيحي: مكتب يطفئ الإضاءة والتكييف في الغرف الفارغة ويوفّر الطاقة.', 'Example project: an office that switches off lights and AC in empty rooms to save energy.'), devices: t('حساسات حضور، تحكم بالتكييف، مفاتيح MixSwitch', 'Presence sensors, AC control, MixSwitch'), images: [office] },
  ],
};

// interface words (not managed in the admin panel)
export const UI = {
  nav: { about: t('من نحن', 'About'), orvibo: t('أورفيبو', 'ORVIBO'), lighting: t('الإضاءة', 'Lighting'), cri: t('جودة اللون', 'Colour quality'), mixpad: t('MixPad', 'MixPad'), lock: t('القفل', 'Lock'), curtain: t('الستائر', 'Curtains'), climate: t('التكييف والتلفزيون', 'Climate & TV'), remote: t('الهاتف', 'Phone'), catalog: t('منتجات أخرى', 'More'), projects: t('أعمالنا', 'Our work'), contact: t('تواصل', 'Contact') },
};
