// Bütçeli sepet: her istenen ürün türü için stoktaki seçeneklerden birini seçer ve toplamı bütçeye sığdırır.
// 1) Her türde orta fiyatlı seçenekle başla  2) Bütçe aşılırsa en çok tasarruf sağlayan türü en ucuza indir
// 3) Hâlâ aşıyorsa öncelik sırasının SONUNDAKİ türleri çıkar  4) Bütçe artarsa düşürülen türleri bir kademe geri yükselt.

export type BudgetOption = { id: string; name: string; unit: number }; // unit = geçerli birim fiyat (indirimliyse indirimli)
export type BudgetSlot = { query: string; qty: number; options: BudgetOption[] }; // options fiyata göre artan
export type BudgetPick = { query: string; option: BudgetOption; qty: number };

export function pickBudgetBasket(slots: BudgetSlot[], budget: number) {
  const usable = slots.filter((s) => s.options.length > 0);
  const idx = usable.map((s) => Math.floor((s.options.length - 1) / 2));
  const active = usable.map(() => true);
  const cost = () => usable.reduce((t, s, i) => t + (active[i] ? s.options[idx[i]].unit * s.qty : 0), 0);

  // 2) ucuzlat: en büyük tasarrufu sağlayan türden başla
  while (cost() > budget) {
    let best = -1;
    let gain = 0;
    usable.forEach((s, i) => {
      if (!active[i] || idx[i] === 0) return;
      const g = (s.options[idx[i]].unit - s.options[0].unit) * s.qty;
      if (g > gain) [best, gain] = [i, g];
    });
    if (best < 0) break;
    idx[best] = 0;
  }
  // 3) çıkar: öncelik sırasının sonundan
  const dropped: string[] = [];
  for (let i = usable.length - 1; i >= 0 && cost() > budget; i--) {
    if (!active[i]) continue;
    active[i] = false;
    dropped.push(usable[i].query);
  }
  // çıkarılanlardan en ucuz hâliyle sığan olursa geri al
  for (let i = 0; i < usable.length; i++) {
    if (active[i]) continue;
    idx[i] = 0;
    if (cost() + usable[i].options[0].unit * usable[i].qty <= budget) {
      active[i] = true;
      dropped.splice(dropped.indexOf(usable[i].query), 1);
    }
  }
  // 4) kalan bütçeyle (öncelik sırasıyla) bir kademe kalite artır
  for (let i = 0; i < usable.length; i++) {
    if (!active[i]) continue;
    const up = Math.min(Math.floor((usable[i].options.length - 1) / 2), usable[i].options.length - 1);
    while (idx[i] < up) {
      const extra = (usable[i].options[idx[i] + 1].unit - usable[i].options[idx[i]].unit) * usable[i].qty;
      if (cost() + extra > budget) break;
      idx[i]++;
    }
  }
  const picks: BudgetPick[] = usable.flatMap((s, i) => (active[i] ? [{ query: s.query, option: s.options[idx[i]], qty: s.qty }] : []));
  const total = Math.round(cost() * 100) / 100;
  return { picks, total, dropped, notFound: slots.filter((s) => !s.options.length).map((s) => s.query) };
}
