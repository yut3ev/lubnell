import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/**
 * REAL LUBNÉL catalog — recovered from upload/lubnel-store-v2.zip
 * (client/src/App.tsx seedProducts). Prices in EGP. Image mapping follows
 * the original manus-storage references where the source photo survived in
 * upload/; brand SVG placeholders cover lost campaign assets.
 */

async function main() {
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();

  const cats = await Promise.all(
    [
      {
        slug: 'sets',
        nameAr: 'مجموعات',
        nameEn: 'Sets',
        description: 'بوكسات مختارة تجمع أفضل منتجات العناية والمكياج بسعر مميز',
        image: '/products/promo-collage.jpg',
        sortOrder: 1,
      },
      {
        slug: 'makeup',
        nameAr: 'مكياج',
        nameEn: 'Makeup',
        description: 'مكياج أصلي بألوان تدوم وملمس ناعم',
        image: '/products/yardbeauty-blush.jpg',
        sortOrder: 2,
      },
      {
        slug: 'skincare',
        nameAr: 'عناية بالبشرة',
        nameEn: 'Skincare',
        description: 'روتين بسيط يمنح بشرتك إشراقة يومية',
        image: '/products/sheglam-remover.jpg',
        sortOrder: 3,
      },
      {
        slug: 'fragrance',
        nameAr: 'عطور',
        nameEn: 'Fragrance',
        description: 'روائح فاخرة ترافقكِ طوال اليوم',
        image: '/products/strawberry-body-mist.jpg',
        sortOrder: 4,
      },
      {
        slug: 'body-care',
        nameAr: 'عناية بالجسم',
        nameEn: 'Body Care',
        description: 'ترطيب وتقشير وروائح تجعل يومكِ أجمل',
        image: '/products/care-more-lotion.jpg',
        sortOrder: 5,
      },
      {
        slug: 'eyes',
        nameAr: 'عيون',
        nameEn: 'Eyes',
        description: 'عناية وإطلالات ساحرة للعيون',
        image: '/products/placeholder-skincare.svg',
        sortOrder: 6,
      },
      {
        slug: 'lips',
        nameAr: 'شفايف',
        nameEn: 'Lips',
        description: 'درجات شفايف دافئة تناسب كل إطلالة',
        image: '/products/placeholder-editorial.svg',
        sortOrder: 7,
      },
    ].map((c) => db.category.create({ data: c }))
  );

  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;
  const V = (arr: { label: string; value: string }[]) => JSON.stringify(arr);

  await db.product.createMany({
    data: [
      // ---------- Sets ----------
      {
        slug: 'university-box',
        nameEn: 'University Beauty Box',
        nameAr: 'بوكس الجامعة',
        categoryId: catId('sets'),
        price: 200,
        description:
          'مجموعة عناية ومكياج تضم كريم صنفرة إيفونا، رول أون، طقم قص أظافر، توك شعر وقلم تحديد.',
        image: '/products/placeholder-editorial.svg',
        categoryId: catId('sets'),
        badgeAr: 'بوكس محدود',
        badgeEn: 'Limited set',
        featured: true,
        stock: 8,
        variants: V([{ label: 'النسخة', value: 'University Box' }]),
      },
      {
        slug: 'care-makeup-box',
        nameEn: 'Care & Makeup Box',
        nameAr: 'بوكس العناية والمكياج',
        categoryId: catId('sets'),
        price: 125,
        description: 'سكراب جسم، ماسك العسل الملكي، بيوتي بلندر أرنب وقلمان للمكياج.',
        image: '/products/placeholder-box.svg',
        categoryId: catId('sets'),
        badgeAr: 'أفضل قيمة',
        badgeEn: 'Best value',
        stock: 9,
        variants: V([{ label: 'النسخة', value: 'Care & Makeup Box' }]),
      },
      {
        slug: 'avocado-cucumber-box',
        nameEn: 'Avocado & Cucumber Care Box',
        nameAr: 'بوكس العناية بالأفوكادو والخيار',
        categoryId: catId('sets'),
        price: 180,
        description:
          'ماسك أفوكادو، سكراب خيار، غسول إيفا بالزبادي والخيار، بيوتي بلندر وتوك شعر.',
        image: '/products/placeholder-box.svg',
        categoryId: catId('sets'),
        badgeAr: 'السعر قيد التحديد',
        badgeEn: 'Price pending',
        stock: 8,
        variants: V([{ label: 'النسخة', value: 'Avocado & Cucumber Box' }]),
      },
      {
        slug: 'starky-eva-set',
        nameEn: 'Starky & Eva Cucumber Set',
        nameAr: 'مجموعة ستاركي وإيفا',
        categoryId: catId('sets'),
        price: 130,
        description:
          'كريم مقشر الخيار من ستاركي مع غسول الوجه ومزيل المكياج بالزبادي والخيار من إيفا.',
        image: '/products/starky-cucumber.jpg',
        categoryId: catId('sets'),
        badgeAr: 'السعر قيد التحديد',
        badgeEn: 'Price pending',
        stock: 10,
        variants: V([{ label: 'النسخة', value: 'Starky & Eva Set' }]),
      },
      {
        slug: 'strawberry-lip-set',
        nameEn: 'Strawberry Lip Set',
        nameAr: 'عرض الفراولة — روج وتحديد',
        categoryId: catId('lips'),
        price: 200,
        description: 'أحمر شفاه أحمر مع قلم تحديد شفاه وبراية.',
        image: '/products/placeholder-box.svg',
        categoryId: catId('lips'),
        badgeAr: 'عرض محدود',
        badgeEn: 'Limited offer',
        stock: 7,
        variants: V([{ label: 'اللون', value: 'Red' }]),
      },
      {
        slug: 'strawberry-body-mist',
        nameEn: 'The Body Shop Strawberry Mist',
        nameAr: 'عرض الفراولة — معطر جسم',
        categoryId: catId('fragrance'),
        price: 200,
        description: 'سبلاش ومعطر جسم برائحة الفراولة.',
        image: '/products/strawberry-body-mist.jpg',
        categoryId: catId('fragrance'),
        badgeAr: 'عرض محدود',
        badgeEn: 'Limited offer',
        stock: 8,
        variants: V([{ label: 'الحجم', value: '100ml' }]),
      },
      // ---------- Makeup ----------
      {
        slug: 'yardbeauty-liquid-blush',
        nameEn: 'YardBeauty Liquid Blush',
        nameAr: 'بلاشر سائل — YardBeauty',
        categoryId: catId('makeup'),
        price: 95,
        description: 'بلاشر خدود سائل بلمسة ناعمة وسهلة الدمج.',
        image: '/products/yardbeauty-blush.jpg',
        categoryId: catId('makeup'),
        badgeAr: 'تحت 100 ج.م',
        badgeEn: 'Under 100 EGP',
        stock: 25,
        variants: V([
          { label: 'اللون', value: 'Peach' },
          { label: 'اللون', value: 'Rose' },
        ]),
      },
      // ---------- Skincare ----------
      {
        slug: 'sheglam-clear-away-remover',
        nameEn: 'SHEGLAM Clear Away Remover',
        nameAr: 'مزيل مكياج شيكلام للعين والشفاه',
        categoryId: catId('skincare'),
        price: 95,
        description: 'مزيل مكياج للعين والشفاه للاستخدام اليومي.',
        image: '/products/sheglam-remover.jpg',
        categoryId: catId('skincare'),
        badgeAr: 'تحت 100 ج.م',
        badgeEn: 'Under 100 EGP',
        stock: 18,
        variants: V([{ label: 'الحجم', value: '100ml' }]),
      },
      {
        slug: 'disaar-vitamin-c-eye-gel',
        nameEn: 'Disaar Vitamin C Eye Gel',
        nameAr: 'كريم وجل عيون ديسار',
        categoryId: catId('eyes'),
        price: 85,
        description: 'كريم محيط العين بفيتامين سي وحمض الهيالورونيك.',
        image: '/products/placeholder-skincare.svg',
        categoryId: catId('eyes'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 18,
        variants: V([{ label: 'الحجم', value: '20g' }]),
      },
      // ---------- Body Care ----------
      {
        slug: 'boscarest-purity-musk-wash',
        nameEn: 'Boscarest Purity Musk Wash',
        nameAr: 'غسول مسك الطهارة — بوسكاريست',
        categoryId: catId('body-care'),
        price: 95,
        description: 'غسول حميمي للمناطق الحساسة بمسك الطهارة.',
        image: '/products/boscarest-musk-wash.jpg',
        gallery: JSON.stringify([
          '/products/boscarest-musk-wash.jpg',
          '/products/boscarest-musk-wash-2.jpg',
        ]),
        categoryId: catId('body-care'),
        badgeAr: 'تحت 100 ج.م',
        badgeEn: 'Under 100 EGP',
        featured: true,
        stock: 20,
        variants: V([{ label: 'الحجم', value: '250ml' }]),
      },
      {
        slug: 'bom-watermelon-body-butter',
        nameEn: 'BOM Watermelon Body Butter',
        nameAr: 'زبدة جسم بوم — بطيخ وفراولة وكاندي',
        categoryId: catId('body-care'),
        price: 85,
        description: 'زبدة جسم برائحة البطيخ والفراولة والحلوى.',
        image: '/products/placeholder-skincare.svg',
        categoryId: catId('body-care'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 16,
        variants: V([
          { label: 'الرائحة', value: 'Watermelon' },
          { label: 'الرائحة', value: 'Strawberry' },
          { label: 'الرائحة', value: 'Candy' },
        ]),
      },
      {
        slug: 'soap-glory-scrub-glove',
        nameEn: 'Soap & Glory Exfoliating Scrub Glove',
        nameAr: 'قفاز تقشير الجسم الوردي',
        categoryId: catId('body-care'),
        price: 80,
        description: 'ليفة وقناع تقشير واستحمام وردي.',
        image: '/products/soap-glory-glove.jpg',
        categoryId: catId('body-care'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 30,
        variants: V([{ label: 'اللون', value: 'Pink' }]),
      },
      {
        slug: 'essence-face-body-lotion',
        nameEn: 'Essence Face & Body Lotion',
        nameAr: 'لوشن الجسم إيسنس للوجه والجسم',
        categoryId: catId('body-care'),
        price: 80,
        description: 'لوشن خفيف لترطيب الوجه والجسم.',
        image: '/products/essence-lotion.jpg',
        categoryId: catId('body-care'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 20,
        variants: V([{ label: 'الحجم', value: '250ml' }]),
      },
      {
        slug: 'care-more-body-lotion',
        nameEn: 'Care & More Body Lotion',
        nameAr: 'لوشن الجسم كير أند مور',
        categoryId: catId('body-care'),
        price: 85,
        description: 'لوشن جسم بروائح التوت والفراولة وجوز الهند والتروبيكال.',
        image: '/products/care-more-lotion.jpg',
        categoryId: catId('body-care'),
        badgeAr: 'السعر قيد التحديد',
        badgeEn: 'Price pending',
        featured: true,
        stock: 15,
        variants: V([
          { label: 'الرائحة', value: 'Mixed Berries' },
          { label: 'الرائحة', value: 'Strawberry' },
          { label: 'الرائحة', value: 'Coconut' },
          { label: 'الرائحة', value: 'Tropical' },
        ]),
      },
      {
        slug: 'bodylicious-roll-on',
        nameEn: 'Bodylicious Deodorant Roll-On',
        nameAr: 'مزيل عرق بوديليشيوس رول أون',
        categoryId: catId('body-care'),
        price: 80,
        description: 'رول أون بروائح Pink Vanilla Fusion وViolet Patchouli.',
        image: '/products/product.svg',
        categoryId: catId('body-care'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 22,
        variants: V([
          { label: 'الرائحة', value: 'Pink Vanilla Fusion' },
          { label: 'الرائحة', value: 'Violet Patchouli' },
        ]),
      },
      {
        slug: 'indulekha-bringha-hair-oil',
        nameEn: 'Indulekha Bringha Hair Oil',
        nameAr: 'زيت شعر إندوليكا برينغا',
        categoryId: catId('body-care'),
        price: 85,
        description: 'زيت شعر هندي للعناية والتغذية.',
        image: '/products/placeholder-editorial.svg',
        categoryId: catId('body-care'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 14,
        variants: V([{ label: 'الحجم', value: '100ml' }]),
      },
      {
        slug: 'vaseline-hair-tonic',
        nameEn: 'Vaseline Hair Tonic Set',
        nameAr: 'تونك وفازلين الشعر',
        categoryId: catId('body-care'),
        price: 150,
        description: 'كريم وتونك شعر بفازلين للتقوية والتغذية.',
        image: '/products/vaseline-hair-tonic.jpg',
        categoryId: catId('body-care'),
        badgeAr: 'السعر قيد التحديد',
        badgeEn: 'Price pending',
        stock: 10,
        variants: V([{ label: 'الحجم', value: '100ml' }]),
      },
      // ---------- Eyes ----------
      {
        slug: 'noor-lash-brow-oil',
        nameEn: 'Noor Lash & Brow Oil',
        nameAr: 'سيروم زيت الرموش والحواجب — نور',
        categoryId: catId('eyes'),
        price: 80,
        description: 'سيروم زيتي للعناية اليومية بالرموش والحواجب.',
        image: '/products/product.svg',
        categoryId: catId('eyes'),
        badgeAr: 'تحت 90 ج.م',
        badgeEn: 'Under 90 EGP',
        stock: 18,
        variants: V([{ label: 'الحجم', value: '10ml' }]),
      },
      // ---------- Sets extra ----------
      {
        slug: 'stainless-star-necklaces',
        nameEn: 'Stainless Star Necklaces',
        nameAr: 'سلاسل ستانلس ستيل بنجمة',
        categoryId: catId('sets'),
        price: 95,
        description: 'قلادات نسائية بأشكال نجمة من الستانلس ستيل.',
        image: '/products/placeholder-editorial.svg',
        categoryId: catId('sets'),
        badgeAr: 'تحت 100 ج.م',
        badgeEn: 'Under 100 EGP',
        stock: 12,
        variants: V([
          { label: 'اللون', value: 'Silver' },
          { label: 'اللون', value: 'Gold' },
          { label: 'اللون', value: 'Rose Gold' },
        ]),
      },
    ],
  });

  const count = await db.product.count();
  console.log(`Seeded REAL LUBNÉL catalog: ${count} products across ${cats.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
