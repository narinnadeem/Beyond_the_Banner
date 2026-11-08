// Experimental design: 2 (banner: absent/present) x 2 (tracking: off/on), within subjects.
// Each participant visits 4 fictional websites. Site content order is fixed;
// the condition shown on each position is counterbalanced with a balanced Latin square.

const CONDITIONS = {
  A: { code: 'B0T0', banner: false, tracked: false },
  B: { code: 'B0T1', banner: false, tracked: true },
  C: { code: 'B1T0', banner: true, tracked: false },
  D: { code: 'B1T1', banner: true, tracked: true },
};

// Balanced Latin square for 4 conditions (Williams design):
// every condition appears once in every position and follows every other condition once.
const ORDERS = [
  ['A', 'B', 'D', 'C'],
  ['B', 'C', 'A', 'D'],
  ['C', 'D', 'B', 'A'],
  ['D', 'A', 'C', 'B'],
];

// Ten data types shown in the per-site checklist.
// truth = whether a TRACKED page actually collects it. Untracked pages collect none of them.
const CHECKLIST = [
  { id: 'time_scroll', label: 'How long you stayed and how far you scrolled', truth: true },
  { id: 'screen', label: 'Your screen size', truth: true },
  { id: 'timezone_lang', label: 'Your timezone and language settings', truth: true },
  { id: 'gpu', label: 'Your graphics card model', truth: true },
  { id: 'browser_os', label: 'Your browser and operating system', truth: true },
  { id: 'contacts', label: 'Your phone contacts', truth: false },
  { id: 'gps', label: 'Your precise GPS location', truth: false },
  { id: 'history', label: 'Websites you visited before this one', truth: false },
  { id: 'passwords', label: 'Your saved passwords', truth: false },
  { id: 'files', label: 'Photos or files on your device', truth: false },
];

const SITES = [
  {
    n: 1,
    name: 'FixCompare',
    tagline: 'Honest repair reviews from Karachi',
    theme: 'theme-fix',
    category: 'Laptop repair',
    title: 'Byte Bay vs FixForward: which laptop repair shop should you trust?',
    options: ['Byte Bay', 'FixForward'],
    body: [
      'We took the same water-damaged laptop to two repair shops near Tariq Road and asked each for a diagnosis, a quote and a turnaround time.',
      '<strong>Byte Bay</strong> diagnosed the fault in about twenty minutes and quoted Rs. 9,500 for a keyboard and motherboard clean. They promised the laptop back in two days and kept that promise. The shop is cramped and the staff were busy, but they explained every step and handed back the replaced parts without being asked.',
      '<strong>FixForward</strong> asked to keep the laptop overnight for diagnosis, then quoted Rs. 7,800 for the same work. Turnaround was four days. The service counter is clean and organised, and they offer a 60-day warranty compared with Byte Bay\'s 30 days. Communication was mostly by WhatsApp and replies were slow.',
      '<strong>Our take:</strong> Byte Bay wins on speed and transparency, FixForward on price and warranty. If you need the machine back for exams, the extra Rs. 1,700 may be worth it.',
    ],
  },
  {
    n: 2,
    name: 'TiffinTrack',
    tagline: 'Lunch-box services, tasted and rated',
    theme: 'theme-tiffin',
    category: 'Home lunch delivery',
    title: 'Ghar Ka Khana Co. vs DabbaDaily: a two-week tiffin test',
    options: ['Ghar Ka Khana Co.', 'DabbaDaily'],
    body: [
      'For two weeks we ordered office lunches from two home-style tiffin services that deliver around Shahrah-e-Faisal.',
      '<strong>Ghar Ka Khana Co.</strong> costs Rs. 6,500 a month for weekday lunches. The menu rotates daily between daal, sabzi and one meat dish twice a week. Portions were generous and the food tasted genuinely homemade, although the roti sometimes arrived cold. Delivery was late three times in ten days.',
      '<strong>DabbaDaily</strong> costs Rs. 8,200 a month and lets you pick meals a week in advance from an app. Packaging was sealed and the food arrived hot every day. Flavours were milder and portions smaller, and two of the chicken dishes were noticeably oily.',
      '<strong>Our take:</strong> Ghar Ka Khana Co. is the better value and tastes more like home. DabbaDaily is more reliable if your lunch break is fixed.',
    ],
  },
  {
    n: 3,
    name: 'TutorTally',
    tagline: 'Comparing tuition centres so parents don\'t have to',
    theme: 'theme-tutor',
    category: 'O-Level maths tuition',
    title: 'Apex Academy vs The Study Loft for O-Level Mathematics',
    options: ['Apex Academy', 'The Study Loft'],
    body: [
      'We spoke to six students and sat in on one class at each of two O-Level maths tuition centres in Gulshan-e-Iqbal.',
      '<strong>Apex Academy</strong> runs batches of about 25 students for Rs. 12,000 a month. The lead teacher is experienced and the past-paper practice is relentless. Students said the pace suits strong learners but that it is hard to ask questions in a large group.',
      '<strong>The Study Loft</strong> keeps batches under 10 and charges Rs. 15,000 a month. Teaching is slower and more conversational, with a weekly one-to-one check-in. Two students said the centre sometimes cancels at short notice because it has fewer teachers.',
      '<strong>Our take:</strong> Apex Academy suits confident students who want volume practice. The Study Loft is better for students who need attention and can afford the higher fee.',
    ],
  },
  {
    n: 4,
    name: 'GymGuide KHI',
    tagline: 'Gyms reviewed by people who actually train',
    theme: 'theme-gym',
    category: 'Gym membership',
    title: 'IronHouse vs PulseFit: which gym is worth your money?',
    options: ['IronHouse', 'PulseFit'],
    body: [
      'We trained for a week at two gyms in DHA Phase 6, visiting at peak evening hours and early mornings.',
      '<strong>IronHouse</strong> charges Rs. 7,000 a month. It has the better free-weights section and serious lifters, but the cardio machines are old and the changing rooms need work. It gets very crowded between 7 and 9 pm.',
      '<strong>PulseFit</strong> charges Rs. 11,000 a month. Equipment is newer, the air conditioning actually works, and group classes are included. Trainers pushed paid personal-training packages quite hard during our visits.',
      '<strong>Our take:</strong> IronHouse for strength training on a budget, PulseFit if you want classes and comfort and can ignore the upselling.',
    ],
  },
];

function orderForIndex(i) {
  return ORDERS[i % ORDERS.length];
}

function conditionAt(orderIndex, position /* 1-based */) {
  const key = ORDERS[orderIndex][position - 1];
  return { key, ...CONDITIONS[key] };
}

module.exports = { CONDITIONS, ORDERS, CHECKLIST, SITES, orderForIndex, conditionAt };
