/**
 * Checklist categories and items — exact order from the paper form.
 * optionalExists: items marked with a dot on the original form.
 */
window.CHECKLIST = [
  {
    id: "carpentry",
    name: "נגרות",
    items: [
      { id: "entrance-door", name: "דלת כניסה, גליוטינה ועינית" },
      { id: "door-closer", name: "מחזיר דלת וסטופר" },
      { id: "door-frame-latch", name: "משקוף ולשונית" },
      { id: "bath-door-frame", name: "משקוף דלת אמבטיה" },
      { id: "full-mirror", name: "מראת גוף" },
      { id: "wardrobe", name: "ארון" },
      { id: "kitchenette-cabinet", name: "ארון מטבחון" },
      { id: "tv-glass", name: "זכוכית טלוויזיה" },
      { id: "sliding-doors", name: "דלתות הזזה", optionalExists: true },
      { id: "bed-headboard", name: "גב מיטה" },
      { id: "bedside-tables", name: "שידות קבועות לצד המיטה" },
      { id: "bed-base", name: "בסיס מיטה" },
      { id: "desk-chair", name: "כיסא מכתבה" },
      { id: "desk", name: "מכתבה" },
      { id: "armchair", name: "כורסה" },
      { id: "round-table", name: "שולחן עגול" },
      { id: "dining-sideboard", name: "מזנון אוכל", optionalExists: true }
    ]
  },
  {
    id: "plaster-paint",
    name: "גבס וצבע",
    items: [
      { id: "foyer-room-ceiling", name: "תקרת מבואה וחדר" },
      { id: "tv-foyer-wall", name: "קיר טלוויזיה ומבואה" },
      { id: "ceiling-drop-ac", name: "הנמכת תקרה וחזית מזגן" },
      { id: "clad-ceiling-cornice", name: "תקרת חיפוי וקרניז עליון" },
      { id: "curtain-cornice-vitrine", name: "קרניז וילון וקיר ויטרינה" },
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
      { id: "coping-rail-window", name: "קופינג, מעקה מרפסת או חלון" },
      { id: "polymer-skirting", name: "פנל פולימרי ופס ניתוק" },
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
      { id: "vitrine-window", name: "ויטרינה או חלון" }
    ]
  },
  {
    id: "plumbing",
    name: "אינסטלציה",
    items: [
      { id: "sink-faucet-siphon", name: "כיור רחצה, ברז וסיפון" },
      { id: "toilet-button-lid", name: "אסלה, לחצן ומכסה" },
      { id: "shower-mixer", name: "אינטרפוץ מקלחון" },
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
    name: "מיזוג אוויר",
    items: [
      { id: "supply-grille", name: "תריס אספקה" },
      { id: "return-grille", name: "תריס אוויר חוזר" },
      { id: "fresh-air-grille", name: "תריס או תעלת אוויר צח" },
      { id: "bath-exhaust", name: "תריס יניקה באמבטיה" },
      { id: "access-panel", name: "פתח גישה ותפעול" },
      { id: "ac-drain", name: "ניקוז מזגן" }
    ]
  },
  {
    id: "electrical",
    name: "חשמל ובקרה",
    items: [
      { id: "entrance-microswitch", name: "מיקרו־סוויץ' דלת כניסה" },
      { id: "dnd", name: "DND" },
      { id: "foyer-switches", name: "מפסקים במבואה וסדר הדלקות" },
      { id: "wardrobe-leds", name: "לדים ותאורה בארון" },
      { id: "wardrobe-microswitch", name: "מיקרו־סוויץ' ארון" },
      { id: "room-ceiling-led", name: "לד תקרת חדר או קיר דקורטיבי" },
      { id: "foyer-light", name: "גוף תאורה במבואה" },
      { id: "tv-console-light", name: "גוף תאורה בשידת הטלוויזיה" },
      { id: "desk-sockets", name: "שקעים לצד המכתבה" },
      { id: "service-socket", name: "שקע שירות" },
      { id: "tv-antenna-socket", name: "שקע טלוויזיה ואנטנה" },
      { id: "minibar-coffee-sockets", name: "שקעי מיניבר וערכת קפה" },
      { id: "ir", name: "IR" },
      { id: "recessed-ceiling-lights", name: "גופי תאורה שקועים בתקרה" },
      { id: "window-microswitch", name: "מיקרו־סוויץ' חלון או ויטרינה" },
      { id: "bedside-reading-lights", name: "גופי תאורה בשידות לילה ומנורות קריאה" },
      { id: "headboard-sockets", name: "שקעים ומפסקים בגב המיטה" },
      { id: "orientation-light", name: "תאורת התמצאות" },
      { id: "bath-lighting", name: "תאורת אמבטיה" },
      { id: "mirror-led", name: "לד כיור מסביב למראה" },
      { id: "phone-comm-socket", name: "שקע טלפון או תקשורת" },
      { id: "ceiling-junction-access", name: "גישה לקופסאות חיבורים בתקרה" },
      { id: "control-box-access", name: "גישה לקופסת הבקרה" },
      { id: "pa-speaker", name: "רמקול כריזה" }
    ]
  },
  {
    id: "bath-accessories",
    name: "אביזרי אמבטיה",
    items: [
      { id: "towel-robe-hook", name: "מתלה מגבת או חלוק" },
      { id: "toilet-paper-holder", name: "מתקן נייר טואלט" },
      { id: "spare-toilet-paper", name: "מתקן נייר טואלט רזרבי" },
      { id: "waste-bin", name: "פח אשפה" },
      { id: "sink-towel-hooks", name: "ווים לתליית מגבות לצד הכיור" },
      { id: "shower-towel-bar", name: "מוט מגבת במקלחון" },
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
      { id: "tv-screen", name: "מסך טלוויזיה" },
      { id: "carpet", name: "שטיח" }
    ]
  }
];

window.APP_META = {
  name: "בדיקת חדרים — The Yacht",
  formName: "טופס בדיקת חדר",
  project: "WEB-HKR-The-Yacht-MP-Room-Inspection-Form",
  copyright: "© כל הזכויות שמורות"
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
