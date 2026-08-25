// مركّب القالب: اختيارات المعالج تصير قالبَ يومٍ واحدًا عبر دالة محضة مفحوصة —
// فالمعالج واجهةٌ فقط، وصورةُ اليوم كلُّها بياناتٌ تخرج من هنا.
//
// المدخلات:
//   prayerMinutes: { fajr, dhuhr, asr, maghrib, isha }        مدد الصلوات
//   sleep: {
//     start: 'afterIsha' | k(1..4)   متى ينام: بعد العشاء (نمط النبي ﷺ) أو عند سدس الليل k
//     hoursMin, hoursMax             مجموع نومه بين حدّين — والقيلولة تُكمل إليه
//     qaylulah: bool                 قيلولة نهارية (نومة توازن بدورات كاملة)
//     cycle: 90                      طول دورة النوم بالدقائق
//   }
//   qiyam: null | { sixth: s(1..5), minutes: n|null }   قيام الليل عند سدسه s،
//     بمدة دقائق أو سدسًا كاملًا (null) — كما قام النبي ﷺ سدسَ الليل
//   meals: [{ name, prayer, fastingSkip? }]   وجبات تُلحق ببلوك المهام الذي يلي صلاتها
//   betweenLine?: نص ما بين الأذان والإقامة
export function composeDayTemplate({ prayerMinutes = {}, sleep = {}, qiyam = null, meals = [] } = {}) {
  const m = {
    fajr: 45,
    dhuhr: 45,
    asr: 45,
    maghrib: 45,
    isha: 45,
    ...prayerMinutes,
  };
  const sl = { start: 'afterIsha', hoursMin: 6, hoursMax: 7, qaylulah: true, cycle: 90, ...sleep };

  const blocks = [];
  const B = (b) => blocks.push(b);

  // ── آخر الليل: النومة التي تسبق الفجر تفتتح الوحدة قانونًا ──
  B({ id: 'sleep2', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'fajr' } });

  // ── النهار ──
  B({ id: 'fajr', title: 'الفجر', colorId: 10, gen: 'fajr', end: { len: m.fajr } });
  B({ id: 'quran', title: 'مهام', colorId: 10, gen: 'quran', task: true, end: { prayer: 'sunrise', offset: 90 } });
  if (sl.qaylulah)
    B({
      id: 'nap',
      title: 'قيلولة',
      colorId: 8,
      sleep: true,
      end: {
        balance: {
          targetMin: Math.round(sl.hoursMin * 60),
          targetMax: Math.round(sl.hoursMax * 60),
          min: 0,
          max: 240,
          keepAfter: 45,
          cycle: sl.cycle,
        },
      },
    });
  B({ id: 'work1', title: 'مهام', colorId: 6, items: [], task: true, end: { prayer: 'dhuhr' } });
  B({ id: 'dhuhr', title: 'الظهر', colorId: 9, gen: 'dhuhr', end: { prayer: 'dhuhr', offset: m.dhuhr } });
  B({ id: 'work2', title: 'مهام', colorId: 6, items: [], task: true, end: { prayer: 'asr' } });
  B({ id: 'asr', title: 'العصر', colorId: 9, gen: 'asr', end: { len: m.asr } });
  B({ id: 'work3', title: 'مهام', colorId: 6, items: [], task: true, end: { prayer: 'maghrib' } });
  B({ id: 'maghrib', title: 'المغرب', colorId: 9, gen: 'maghribWeekend', end: { len: m.maghrib } });
  B({ id: 'eve0', title: 'وقتك', colorId: 6, items: [], task: true, end: { prayer: 'isha' } });
  B({ id: 'isha', title: 'العشاء', colorId: 9, gen: 'isha', end: { len: m.isha } });

  // ── الليل: سهرٌ إن لم يكن النوم بعد العشاء، ثم نومٌ فقيامٌ إن أراده ──
  const afterIsha = sl.start === 'afterIsha';
  if (!afterIsha) B({ id: 'eve', title: 'وقتك', colorId: 6, items: [], task: true, end: { nightPart: sl.start } });

  let startAnchor;
  if (qiyam) {
    const s = qiyam.sixth;
    B({ id: 'sleepN', title: 'نوم', colorId: 8, sleep: true, end: { nightPart: s } });
    if (qiyam.minutes == null) {
      // سدسٌ كامل — كما قام النبي ﷺ سدسَ الليل ثم نام سدسَه الأخير
      B({ id: 'qiyam', title: 'قيام الليل', colorId: 9, gen: 'qiyamWeekend', end: { nightPart: s + 1 } });
      startAnchor = { nightPrev: s + 1 };
    } else {
      B({ id: 'qiyam', title: 'قيام الليل', colorId: 9, gen: 'qiyamWeekend', end: { nightPart: s, offset: qiyam.minutes } });
      startAnchor = { nightPrev: s, offset: qiyam.minutes };
    }
  } else if (afterIsha) {
    // لا قيام ولا سهر: الوحدة تنتهي بنهاية العشاء، وسريرُه بعده مباشرة
    startAnchor = { prayer: 'isha', offset: m.isha, prevDay: true };
  } else {
    startAnchor = { nightPrev: sl.start };
  }

  // ── الوجبات: كلٌّ في بلوك المهام الذي يلي صلاتها ──
  const mealSlot = { fajr: 'quran', dhuhr: 'work2', asr: 'work3', maghrib: 'eve0', isha: afterIsha ? 'eve0' : 'eve' };
  meals.forEach((meal, i) => {
    const slot = mealSlot[meal.prayer] || 'work1';
    const blk = blocks.find((b) => b.id === slot);
    if (!blk) return;
    if (!blk.items) blk.items = [];
    blk.items.push({
      id: `meal${i + 1}`,
      text: meal.name,
      ...(meal.fastingSkip ? { fastingSkip: true } : {}),
    });
  });

  return { name: 'يومي', start: startAnchor, blocks };
}
