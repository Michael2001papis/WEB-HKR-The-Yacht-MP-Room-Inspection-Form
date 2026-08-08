/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001 | Release V0.02.0
 * Checklist categories and items — exact order and wording from the approved reject list.
 * optionalExists: items marked with ● on the source form.
 */
window.CHECKLIST = [
  {
    id: "carpentry",
    name: "נגרות",
    items: [
      { id: "entrance-door", name: "דלת כניסה + גיליוטינה + עינית" },
      { id: "door-closer", name: "מחזיר דלת / סטופר" },
      { id: "lock-frame-latch", name: "מנעול + לשונית משקוף" },
      { id: "bath-door-frame", name: "משקוף דלת אמבטיה" },
      { id: "full-mirror", name: "מראת גוף" },
      { id: "wardrobe", name: "ארון" },
      { id: "kitchenette-cabinet", name: "ארון מטבחון" },
      { id: "tv-wall", name: "קיר TV" },
      { id: "sliding-doors", name: "דלתות הזזה", optionalExists: true },
      { id: "bed-headboard", name: "גב מיטה" },
      { id: "bedside-tables", name: "שידות קבועות לצד מיטה" },
      { id: "bed-base", name: "בסיס מיטה" },
      { id: "desk-chair", name: "כיסא מכתבה" },
      { id: "desk", name: "מכתבה" },
      { id: "armchair", name: "כורסה" },
      { id: "round-coffee-table", name: "שולחן עגול (קפה)" },
      { id: "dining-sideboard", name: "מזנון אוכל", optionalExists: true }
    ]
  },
  {
    id: "plaster-paint",
    name: "גבס/ צבע",
    items: [
      { id: "foyer-room-ceiling", name: "תקרת מבואה + חדר" },
      { id: "vt-foyer-wall", name: "קיר V.T+מבואה" },
      { id: "ceiling-drop-ac", name: "הנמכת תקרה + חזית מזגן" },
      { id: "perimeter-ceiling-cornice", name: "תקרה היקפית קרניז עליון" },
      { id: "curtain-cornice-vitrine", name: "קרניז וילון+קיר ויטרינה" },
      { id: "bed-gypsum-wall", name: "קיר גבס בגב המיטה" }
    ]
  },
  {
    id: "flooring-cladding",
    name: "ריצוף וחיפוי",
    items: [
      { id: "entrance-threshold", name: "סף כניסה" },
      { id: "foyer-room-floor", name: "ריצוף מבואה וחדר" },
      { id: "balcony-floor-drains", name: "ריצוף מרפסת וניקוזים" },
      { id: "coping-rail-window", name: "קופינג / מעקה מרפסת / חלון" },
      { id: "polymer-skirting", name: "פנל פולימרי / פס ניתוק" },
      { id: "bath-floor", name: "ריצוף אמבטיה" },
      { id: "bath-threshold", name: "סף כניסה לחדר הרחצה" },
      { id: "bath-wall-cladding", name: "חיפוי קירות אמבטיה" },
      { id: "sink-marble", name: "משטח שיש כיור" },
      { id: "lower-marble-shelf", name: "מדף שיש תחתון" }
    ]
  },
  {
    id: "aluminum-glass",
    name: "אלומיניום וזכוכית",
    items: [
      { id: "sink-mirror", name: "מראת כיור" },
      { id: "shower-partition", name: "מחיצת מקלחון" },
      { id: "vitrine-window", name: "ויטרינה / חלון" }
    ]
  },
  {
    id: "plumbing",
    name: "אינסטלציה",
    items: [
      { id: "sink-faucet-siphon", name: "כיור רחצה+ ברז + סיפון" },
      { id: "toilet-button-lid", name: "אסלה + לחצן+מכסה" },
      { id: "shower-unterputz", name: "אונטרפוץ מקלחון" },
      { id: "shower-rail-hose", name: "מאחז, צינור ומזלף מקלחון" },
      { id: "shower-head", name: "ראש דוש" },
      { id: "drain-channel", name: "תעלת ניקוז" }
    ]
  },
  {
    id: "sprinklers",
    name: "ספרינקלרים",
    items: [
      { id: "sprinkler-foyer-room", name: "תקרת מבואה וחדר" },
      { id: "sprinkler-bathroom", name: "חדר אמבטיה" }
    ]
  },
  {
    id: "air-conditioning",
    name: "מיזוג אויר",
    items: [
      { id: "supply-grille", name: "תריס אספקה" },
      { id: "return-grille", name: "תריס אויר חוזר" },
      { id: "fresh-air-grille", name: "תריס / תעלת אויר צח" },
      { id: "bath-exhaust", name: "תריס יניקה באמבטיה" },
      { id: "access-panel", name: "פתח גישה ותפעול" },
      { id: "ac-drain", name: "ניקוז מזגן" }
    ]
  },
  {
    id: "electrical",
    name: "חשמל ובקרה",
    items: [
      { id: "entrance-microswitch", name: "מיקרוסוויצי דלת כניסה" },
      { id: "dnd", name: "DND" },
      { id: "foyer-switches", name: "מפסקים במבואה + סדר הדלקות" },
      { id: "wardrobe-leds", name: "לדים . תאורה בארון" },
      { id: "wardrobe-microswitch", name: "מיקרוסווטש ארון" },
      { id: "room-ceiling-led", name: "לד תקרת חדר / קיר דקורטיבי" },
      { id: "foyer-light", name: "ג\"ת במבואה" },
      { id: "tv-console-light", name: "ג\"ת שידת T.V" },
      { id: "desk-sockets", name: "שקעים לצד המכתבה" },
      { id: "service-socket", name: "שקע שרות" },
      { id: "tv-antenna-socket", name: "שקע T.V + אנטנה" },
      { id: "minibar-coffee-sockets", name: "שקעי מיניבר +ערכת קפה" },
      { id: "ir", name: "IR" },
      { id: "recessed-ceiling-lights", name: "ג\"ת שקועים בתקרה" },
      { id: "window-microswitch", name: "מיקרוסוויטש חלון / ויטרינה" },
      { id: "bedside-reading-lights", name: "ג\"ת שידת לילה + מנורת קריאה" },
      { id: "headboard-sockets", name: "שקעים ומפסקים גב מיטה" },
      { id: "orientation-light", name: "תאורת התמצאות" },
      { id: "bath-lighting", name: "תאורת אמבטיה (שקועים)" },
      { id: "mirror-led", name: "לד כיור סביב המראה" },
      { id: "phone-comm-socket", name: "שקע טלפון/תקשורת" },
      { id: "ceiling-junction-access", name: "גישה לקופסאות חיבורים בתקרה" },
      { id: "control-box-access", name: "גישה לקופסת הבקרה (הוטלו)" },
      { id: "pa-speaker", name: "רמקול כריזה" }
    ]
  },
  {
    id: "bath-accessories",
    name: "אביזרי אמבטיה",
    items: [
      { id: "towel-robe-hook", name: "מתלה מגבת / חלוק" },
      { id: "toilet-paper-holder", name: "מתקן נייר טואלט" },
      { id: "spare-toilet-paper", name: "מתקן נייר טואלט רזרבי" },
      { id: "waste-bin", name: "פח אשפה" },
      { id: "sink-towel-hooks", name: "ווים לתליית מגבות לצד הכיור" },
      { id: "shower-towel-bar", name: "מוט מגבת מגבות מקלחון" },
      { id: "shower-soap-mesh", name: "סבוניית רשת במקלחון" },
      { id: "magnifying-mirror", name: "מראה מגדילה" }
    ]
  },
  {
    id: "room-equipment",
    name: "אבזור חדר",
    items: [
      { id: "room-number-sign", name: "מספר חדר" },
      { id: "mezuzah", name: "מזוזה" },
      { id: "safe", name: "כספת" },
      { id: "minibar", name: "מיניבר" },
      { id: "coffee-kit", name: "ערכת קפה" },
      { id: "hair-dryer", name: "מייבש שיער" },
      { id: "artwork", name: "אומנות", optionalExists: true },
      { id: "telephone", name: "טלפון" },
      { id: "tv-screen", name: "מסך TV" },
      { id: "carpet", name: "שטיח" }
    ]
  }
];

window.APP_META = {
  name: "בדיקת חדרים — The Yacht",
  formName: "טופס בדיקת חדר",
  project: "WEB-HKR-The-Yacht-MP-Room-Inspection-Form",
  version: "V0.02.0",
  author: "MP מיכאל פפיסמדוב 2001",
  copyright: "© הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001"
};

window.itemKey = function itemKey(categoryId, itemId) {
  return categoryId + "." + itemId;
};

window.findItemMeta = function findItemMeta(key) {
  for (const cat of window.CHECKLIST) {
    for (const item of cat.items) {
      if (window.itemKey(cat.id, item.id) === key) {
        return { category: cat, item: item, key: key };
      }
    }
  }
  return null;
};

window.allItemKeys = function allItemKeys() {
  const keys = [];
  for (const cat of window.CHECKLIST) {
    for (const item of cat.items) {
      keys.push(window.itemKey(cat.id, item.id));
    }
  }
  return keys;
};
