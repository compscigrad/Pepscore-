import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// price     = price for 1 box
// bulkPrice5  = price per box when ordering 10 boxes
// bulkPrice10 = price per box when ordering 50 boxes
// costOfGoods = estimated ~30% of single-box price

const products = [
  // ── Semaglutide ──────────────────────────────────────────────────────────
  { slug: 'semaglutide-5mg', name: 'Semaglutide', category: 'GLP-1 Agonist', size: '5mg', price: 138, bulkPrice5: 117, bulkPrice10: 108, imageUrl: '/images/Semaglutide.png', badge: 'Popular', costOfGoods: 41 },
  { slug: 'semaglutide-10mg', name: 'Semaglutide', category: 'GLP-1 Agonist', size: '10mg', price: 165, bulkPrice5: 144, bulkPrice10: 135, imageUrl: '/images/Semaglutide.png', badge: null, costOfGoods: 50 },
  { slug: 'semaglutide-15mg', name: 'Semaglutide', category: 'GLP-1 Agonist', size: '15mg', price: 231, bulkPrice5: 210, bulkPrice10: 201, imageUrl: '/images/Semaglutide.png', badge: null, costOfGoods: 69 },
  { slug: 'semaglutide-20mg', name: 'Semaglutide', category: 'GLP-1 Agonist', size: '20mg', price: 258, bulkPrice5: 237, bulkPrice10: 228, imageUrl: '/images/Semaglutide.png', badge: null, costOfGoods: 77 },
  { slug: 'semaglutide-30mg', name: 'Semaglutide', category: 'GLP-1 Agonist', size: '30mg', price: 318, bulkPrice5: 297, bulkPrice10: 288, imageUrl: '/images/Semaglutide.png', badge: null, costOfGoods: 95 },

  // ── Tirzepatide ───────────────────────────────────────────────────────────
  { slug: 'tirzepatide-5mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '5mg', price: 147, bulkPrice5: 126, bulkPrice10: 117, imageUrl: '/images/Tirzepatide.png', badge: 'Best Seller', costOfGoods: 44 },
  { slug: 'tirzepatide-10mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '10mg', price: 183, bulkPrice5: 162, bulkPrice10: 153, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 55 },
  { slug: 'tirzepatide-15mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '15mg', price: 243, bulkPrice5: 222, bulkPrice10: 213, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 73 },
  { slug: 'tirzepatide-20mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '20mg', price: 327, bulkPrice5: 306, bulkPrice10: 297, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 98 },
  { slug: 'tirzepatide-30mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '30mg', price: 384, bulkPrice5: 363, bulkPrice10: 354, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 115 },
  { slug: 'tirzepatide-40mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '40mg', price: 456, bulkPrice5: 435, bulkPrice10: 426, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 137 },
  { slug: 'tirzepatide-50mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '50mg', price: 609, bulkPrice5: 588, bulkPrice10: 579, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 183 },
  { slug: 'tirzepatide-60mg', name: 'Tirzepatide', category: 'Dual GIP/GLP-1', size: '60mg', price: 696, bulkPrice5: 675, bulkPrice10: 666, imageUrl: '/images/Tirzepatide.png', badge: null, costOfGoods: 209 },

  // ── Retatrutide ───────────────────────────────────────────────────────────
  { slug: 'retatrutide-5mg', name: 'Retatrutide', category: 'Triple Agonist', size: '5mg', price: 240, bulkPrice5: 219, bulkPrice10: 210, imageUrl: '/images/Retatrutide.png', badge: 'New', costOfGoods: 72 },
  { slug: 'retatrutide-10mg', name: 'Retatrutide', category: 'Triple Agonist', size: '10mg', price: 327, bulkPrice5: 306, bulkPrice10: 297, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 98 },
  { slug: 'retatrutide-15mg', name: 'Retatrutide', category: 'Triple Agonist', size: '15mg', price: 426, bulkPrice5: 405, bulkPrice10: 396, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 128 },
  { slug: 'retatrutide-20mg', name: 'Retatrutide', category: 'Triple Agonist', size: '20mg', price: 543, bulkPrice5: 522, bulkPrice10: 513, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 163 },
  { slug: 'retatrutide-24mg', name: 'Retatrutide', category: 'Triple Agonist', size: '24mg', price: 579, bulkPrice5: 558, bulkPrice10: 549, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 174 },
  { slug: 'retatrutide-30mg', name: 'Retatrutide', category: 'Triple Agonist', size: '30mg', price: 642, bulkPrice5: 621, bulkPrice10: 612, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 193 },
  { slug: 'retatrutide-36mg', name: 'Retatrutide', category: 'Triple Agonist', size: '36mg', price: 717, bulkPrice5: 696, bulkPrice10: 687, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 215 },
  { slug: 'retatrutide-40mg', name: 'Retatrutide', category: 'Triple Agonist', size: '40mg', price: 825, bulkPrice5: 804, bulkPrice10: 795, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 248 },
  { slug: 'retatrutide-50mg', name: 'Retatrutide', category: 'Triple Agonist', size: '50mg', price: 936, bulkPrice5: 915, bulkPrice10: 906, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 281 },
  { slug: 'retatrutide-60mg', name: 'Retatrutide', category: 'Triple Agonist', size: '60mg', price: 978, bulkPrice5: 957, bulkPrice10: 948, imageUrl: '/images/Retatrutide.png', badge: null, costOfGoods: 293 },

  // ── Cagrilintide ──────────────────────────────────────────────────────────
  { slug: 'cagrilintide-5mg', name: 'Cagrilintide', category: 'Amylin Analog', size: '5mg', price: 303, bulkPrice5: 282, bulkPrice10: 273, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 91 },
  { slug: 'cagrilintide-10mg', name: 'Cagrilintide', category: 'Amylin Analog', size: '10mg', price: 588, bulkPrice5: 567, bulkPrice10: 558, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 176 },

  // ── Cagrilintide + Semaglutide Combos ────────────────────────────────────
  { slug: 'cagri-sema-2-5mg', name: 'Cagrilintide 2.5mg + Semaglutide 2.5mg', category: 'Combination', size: '5mg', price: 312, bulkPrice5: 291, bulkPrice10: 282, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 94 },
  { slug: 'cagri-sema-5mg', name: 'Cagrilintide 5mg + Semaglutide 5mg', category: 'Combination', size: '10mg', price: 474, bulkPrice5: 453, bulkPrice10: 444, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 142 },

  // ── Survodutide / Mazdutide ───────────────────────────────────────────────
  { slug: 'survodutide-10mg', name: 'Survodutide', category: 'GLP-1 Analog', size: '10mg', price: 900, bulkPrice5: 879, bulkPrice10: 870, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 270 },
  { slug: 'mazdutide-10mg', name: 'Mazdutide', category: 'GLP-1 Analog', size: '10mg', price: 609, bulkPrice5: 588, bulkPrice10: 579, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 183 },

  // ── GHK-Cu ────────────────────────────────────────────────────────────────
  { slug: 'ghk-cu-50mg', name: 'GHK-Cu', category: 'Copper Peptide', size: '50mg', price: 108, bulkPrice5: 87, bulkPrice10: 78, imageUrl: '/images/ghk-cu.png', badge: null, costOfGoods: 32 },
  { slug: 'ghk-cu-100mg', name: 'GHK-Cu', category: 'Copper Peptide', size: '100mg', price: 174, bulkPrice5: 153, bulkPrice10: 144, imageUrl: '/images/ghk-cu.png', badge: null, costOfGoods: 52 },

  // ── Glutathione ───────────────────────────────────────────────────────────
  { slug: 'glutathione-600mg', name: 'Glutathione', category: 'Antioxidant', size: '600mg', price: 126, bulkPrice5: 105, bulkPrice10: 96, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 38 },
  { slug: 'glutathione-1200mg', name: 'Glutathione', category: 'Antioxidant', size: '1200mg', price: 216, bulkPrice5: 195, bulkPrice10: 186, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 65 },
  { slug: 'glutathione-1500mg', name: 'Glutathione', category: 'Antioxidant', size: '1500mg', price: 285, bulkPrice5: 264, bulkPrice10: 255, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 86 },

  // ── NAD+ ──────────────────────────────────────────────────────────────────
  { slug: 'nad-plus-100mg', name: 'NAD+', category: 'Coenzyme', size: '100mg', price: 168, bulkPrice5: 147, bulkPrice10: 138, imageUrl: '/images/nad.png', badge: null, costOfGoods: 50 },
  { slug: 'nad-plus-500mg', name: 'NAD+', category: 'Coenzyme', size: '500mg', price: 264, bulkPrice5: 243, bulkPrice10: 234, imageUrl: '/images/nad.png', badge: null, costOfGoods: 79 },

  // ── Epithalon ─────────────────────────────────────────────────────────────
  { slug: 'epithalon-10mg', name: 'Epithalon', category: 'Longevity Peptide', size: '10mg', price: 144, bulkPrice5: 123, bulkPrice10: 114, imageUrl: '/images/epithalon.png', badge: null, costOfGoods: 43 },
  { slug: 'epithalon-50mg', name: 'Epithalon', category: 'Longevity Peptide', size: '50mg', price: 369, bulkPrice5: 348, bulkPrice10: 339, imageUrl: '/images/epithalon.png', badge: null, costOfGoods: 111 },

  // ── Thymalin ──────────────────────────────────────────────────────────────
  { slug: 'thymalin-10mg', name: 'Thymalin', category: 'Longevity Peptide', size: '10mg', price: 243, bulkPrice5: 222, bulkPrice10: 213, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 73 },

  // ── Thymosin Alpha-1 ──────────────────────────────────────────────────────
  { slug: 'thymosin-alpha1-5mg', name: 'Thymosin Alpha-1', category: 'Longevity Peptide', size: '5mg', price: 327, bulkPrice5: 306, bulkPrice10: 297, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 98 },
  { slug: 'thymosin-alpha1-10mg', name: 'Thymosin Alpha-1', category: 'Longevity Peptide', size: '10mg', price: 492, bulkPrice5: 471, bulkPrice10: 462, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 148 },

  // ── Pinealon ──────────────────────────────────────────────────────────────
  { slug: 'pinealon-5mg', name: 'Pinealon', category: 'Longevity Peptide', size: '5mg', price: 156, bulkPrice5: 135, bulkPrice10: 126, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 47 },
  { slug: 'pinealon-10mg', name: 'Pinealon', category: 'Longevity Peptide', size: '10mg', price: 216, bulkPrice5: 195, bulkPrice10: 186, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 65 },
  { slug: 'pinealon-20mg', name: 'Pinealon', category: 'Longevity Peptide', size: '20mg', price: 297, bulkPrice5: 276, bulkPrice10: 267, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 89 },

  // ── MOTS-c ────────────────────────────────────────────────────────────────
  { slug: 'mots-c-10mg', name: 'MOTS-c', category: 'Mitochondrial Peptide', size: '10mg', price: 222, bulkPrice5: 201, bulkPrice10: 192, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 67 },
  { slug: 'mots-c-40mg', name: 'MOTS-c', category: 'Mitochondrial Peptide', size: '40mg', price: 543, bulkPrice5: 522, bulkPrice10: 513, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 163 },

  // ── SS-31 ─────────────────────────────────────────────────────────────────
  { slug: 'ss-31-10mg', name: 'SS-31', category: 'Mitochondrial Peptide', size: '10mg', price: 282, bulkPrice5: 261, bulkPrice10: 252, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 85 },
  { slug: 'ss-31-50mg', name: 'SS-31', category: 'Mitochondrial Peptide', size: '50mg', price: 1107, bulkPrice5: 1086, bulkPrice10: 1077, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 332 },

  // ── Humanin ───────────────────────────────────────────────────────────────
  { slug: 'humanin-10mg', name: 'Humanin', category: 'Mitochondrial Peptide', size: '10mg', price: 885, bulkPrice5: 864, bulkPrice10: 855, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 266 },

  // ── BPC 157 ───────────────────────────────────────────────────────────────
  { slug: 'bpc-157-5mg', name: 'BPC 157', category: 'Healing Peptide', size: '5mg', price: 156, bulkPrice5: 135, bulkPrice10: 126, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 47 },
  { slug: 'bpc-157-10mg', name: 'BPC 157', category: 'Healing Peptide', size: '10mg', price: 234, bulkPrice5: 213, bulkPrice10: 204, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 70 },

  // ── TB500 ─────────────────────────────────────────────────────────────────
  { slug: 'tb500-5mg', name: 'TB500', category: 'Healing Peptide', size: '5mg', price: 303, bulkPrice5: 282, bulkPrice10: 273, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 91 },
  { slug: 'tb500-10mg', name: 'TB500', category: 'Healing Peptide', size: '10mg', price: 465, bulkPrice5: 444, bulkPrice10: 435, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 140 },

  // ── BPC + TB Combos ───────────────────────────────────────────────────────
  { slug: 'bpc5-tb5-10mg', name: 'BPC5 + TB5', category: 'Healing Peptide', size: '10mg', price: 297, bulkPrice5: 276, bulkPrice10: 267, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 89 },
  { slug: 'bpc10-tb10-20mg', name: 'BPC10 + TB10', category: 'Healing Peptide', size: '20mg', price: 606, bulkPrice5: 585, bulkPrice10: 576, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 182 },

  // ── KPV ───────────────────────────────────────────────────────────────────
  { slug: 'kpv-5mg', name: 'KPV (Lysine-Proline-Valine)', category: 'Healing Peptide', size: '5mg', price: 156, bulkPrice5: 135, bulkPrice10: 126, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 47 },
  { slug: 'kpv-10mg', name: 'KPV (Lysine-Proline-Valine)', category: 'Healing Peptide', size: '10mg', price: 177, bulkPrice5: 156, bulkPrice10: 147, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 53 },

  // ── LL37 ──────────────────────────────────────────────────────────────────
  { slug: 'll37-5mg', name: 'LL37', category: 'Healing Peptide', size: '5mg', price: 291, bulkPrice5: 270, bulkPrice10: 261, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 87 },

  // ── AOD 9604 ──────────────────────────────────────────────────────────────
  { slug: 'aod-9604-5mg', name: 'AOD 9604', category: 'Healing Peptide', size: '5mg', price: 306, bulkPrice5: 285, bulkPrice10: 276, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 92 },

  // ── GLOW / KLOW Combos ───────────────────────────────────────────────────
  { slug: 'glow50-50mg', name: 'GLOW50', category: 'Combination', size: '50mg', price: 462, bulkPrice5: 441, bulkPrice10: 432, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 139 },
  { slug: 'klow-80mg', name: 'KLOW', category: 'Combination', size: '80mg', price: 717, bulkPrice5: 696, bulkPrice10: 687, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 215 },
  { slug: 'bpc-ghk-tb-70mg', name: 'BPC 10mg + GHK-Cu 50mg + TB500 10mg', category: 'Combination', size: '70mg', price: 558, bulkPrice5: 537, bulkPrice10: 528, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 167 },

  // ── CJC-1295 No DAC ───────────────────────────────────────────────────────
  { slug: 'cjc1295-no-dac-5mg', name: 'CJC-1295 No DAC', category: 'GH Secretagogue', size: '5mg', price: 261, bulkPrice5: 240, bulkPrice10: 231, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 78 },
  { slug: 'cjc1295-no-dac-10mg', name: 'CJC-1295 No DAC', category: 'GH Secretagogue', size: '10mg', price: 348, bulkPrice5: 327, bulkPrice10: 318, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 104 },

  // ── CJC-1295 With DAC ─────────────────────────────────────────────────────
  { slug: 'cjc1295-with-dac-2mg', name: 'CJC-1295 With DAC', category: 'GH Secretagogue', size: '2mg', price: 348, bulkPrice5: 327, bulkPrice10: 318, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 104 },
  { slug: 'cjc1295-with-dac-5mg', name: 'CJC-1295 With DAC', category: 'GH Secretagogue', size: '5mg', price: 492, bulkPrice5: 471, bulkPrice10: 462, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 148 },

  // ── CJC-1295 + Ipamorelin Combo ───────────────────────────────────────────
  { slug: 'cjc1295-ipa-10mg', name: 'CJC-1295 without DAC 5mg + Ipamorelin 5mg', category: 'GH Secretagogue', size: '10mg', price: 297, bulkPrice5: 276, bulkPrice10: 267, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 89 },

  // ── Ipamorelin ────────────────────────────────────────────────────────────
  { slug: 'ipamorelin-5mg', name: 'Ipamorelin', category: 'GH Secretagogue', size: '5mg', price: 156, bulkPrice5: 135, bulkPrice10: 126, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 47 },
  { slug: 'ipamorelin-10mg', name: 'Ipamorelin', category: 'GH Secretagogue', size: '10mg', price: 222, bulkPrice5: 201, bulkPrice10: 192, imageUrl: '/images/cjc1295.png', badge: null, costOfGoods: 67 },

  // ── Sermorelin ────────────────────────────────────────────────────────────
  { slug: 'sermorelin-5mg', name: 'Sermorelin Acetate', category: 'GH Secretagogue', size: '5mg', price: 252, bulkPrice5: 231, bulkPrice10: 222, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 76 },
  { slug: 'sermorelin-10mg', name: 'Sermorelin Acetate', category: 'GH Secretagogue', size: '10mg', price: 360, bulkPrice5: 339, bulkPrice10: 330, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 108 },

  // ── GHRP-6 ────────────────────────────────────────────────────────────────
  { slug: 'ghrp-6-5mg', name: 'GHRP-6 Acetate', category: 'GH Secretagogue', size: '5mg', price: 144, bulkPrice5: 123, bulkPrice10: 114, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 43 },

  // ── Tesamorelin ───────────────────────────────────────────────────────────
  { slug: 'tesamorelin-5mg', name: 'Tesamorelin', category: 'GH Secretagogue', size: '5mg', price: 312, bulkPrice5: 291, bulkPrice10: 282, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 94 },
  { slug: 'tesamorelin-10mg', name: 'Tesamorelin', category: 'GH Secretagogue', size: '10mg', price: 531, bulkPrice5: 510, bulkPrice10: 501, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 159 },

  // ── HGH ───────────────────────────────────────────────────────────────────
  { slug: 'hgh-10iu', name: 'HGH', category: 'GH Secretagogue', size: '10iu', price: 186, bulkPrice5: 165, bulkPrice10: 156, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 56 },
  { slug: 'hgh-15iu', name: 'HGH', category: 'GH Secretagogue', size: '15iu', price: 261, bulkPrice5: 240, bulkPrice10: 231, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 78 },
  { slug: 'hgh-24iu', name: 'HGH', category: 'GH Secretagogue', size: '24iu', price: 507, bulkPrice5: 486, bulkPrice10: 477, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 152 },

  // ── IGF ───────────────────────────────────────────────────────────────────
  { slug: 'igf-ilr3-0-1mg', name: 'IGF-ILR3', category: 'Growth Factor', size: '0.1mg', price: 162, bulkPrice5: 141, bulkPrice10: 132, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 49 },
  { slug: 'igf-ilr3-1mg', name: 'IGF-ILR3', category: 'Growth Factor', size: '1mg', price: 558, bulkPrice5: 537, bulkPrice10: 528, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 167 },
  { slug: 'igf-des-2mg', name: 'IGF-DES', category: 'Growth Factor', size: '2mg', price: 225, bulkPrice5: 204, bulkPrice10: 195, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 68 },

  // ── Melanocortin ──────────────────────────────────────────────────────────
  { slug: 'mt-2-10mg', name: 'MT-2', category: 'Melanocortin Peptide', size: '10mg', price: 171, bulkPrice5: 150, bulkPrice10: 141, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 51 },
  { slug: 'mt1-5mg', name: 'MT1', category: 'Melanocortin Peptide', size: '5mg (1 vial)', price: 222, bulkPrice5: 201, bulkPrice10: 192, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 67 },
  { slug: 'pt-141-10mg', name: 'PT-141', category: 'Melanocortin Peptide', size: '10mg', price: 192, bulkPrice5: 171, bulkPrice10: 162, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 58 },
  { slug: 'dermorphin-5mg', name: 'Dermorphin', category: 'Opioid Peptide', size: '5mg', price: 174, bulkPrice5: 153, bulkPrice10: 144, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 52 },

  // ── Reproductive / Hormones ───────────────────────────────────────────────
  { slug: 'kisspeptin-10-5mg', name: 'KissPeptin-10', category: 'Reproductive Peptide', size: '5mg', price: 186, bulkPrice5: 165, bulkPrice10: 156, imageUrl: '/images/kisspeptin.png', badge: null, costOfGoods: 56 },
  { slug: 'kisspeptin-10-10mg', name: 'KissPeptin-10', category: 'Reproductive Peptide', size: '10mg', price: 285, bulkPrice5: 264, bulkPrice10: 255, imageUrl: '/images/kisspeptin.png', badge: null, costOfGoods: 86 },
  { slug: 'oxytocin-2mg', name: 'Oxytocin', category: 'Reproductive Peptide', size: '2mg', price: 129, bulkPrice5: 108, bulkPrice10: 99, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 39 },
  { slug: 'oxytocin-10mg', name: 'Oxytocin', category: 'Reproductive Peptide', size: '10mg', price: 210, bulkPrice5: 189, bulkPrice10: 180, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 63 },
  { slug: 'hcg-5000iu', name: 'HCG', category: 'Hormone', size: '5000iu', price: 273, bulkPrice5: 252, bulkPrice10: 243, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 82 },
  { slug: 'hcg-10000iu', name: 'HCG', category: 'Hormone', size: '10000iu', price: 477, bulkPrice5: 456, bulkPrice10: 447, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 143 },
  { slug: 'hmg-75iu', name: 'HMG', category: 'Hormone', size: '75iu', price: 216, bulkPrice5: 195, bulkPrice10: 186, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 65 },
  { slug: 'epo-3000iu', name: 'EPO 3000IU', category: 'Hormone', size: '3000iu', price: 318, bulkPrice5: 297, bulkPrice10: 288, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 95 },

  // ── Nootropic / Neuropeptide ───────────────────────────────────────────────
  { slug: 'semax-5mg', name: 'Semax', category: 'Nootropic', size: '5mg', price: 129, bulkPrice5: 108, bulkPrice10: 99, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 39 },
  { slug: 'semax-11mg', name: 'Semax', category: 'Nootropic', size: '11mg', price: 249, bulkPrice5: 228, bulkPrice10: 219, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 75 },
  { slug: 'selank-5mg', name: 'Selank', category: 'Nootropic', size: '5mg', price: 129, bulkPrice5: 108, bulkPrice10: 99, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 39 },
  { slug: 'selank-11mg', name: 'Selank', category: 'Nootropic', size: '11mg', price: 225, bulkPrice5: 204, bulkPrice10: 195, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 68 },
  { slug: 'dsip-5mg', name: 'DSIP', category: 'Nootropic', size: '5mg', price: 174, bulkPrice5: 153, bulkPrice10: 144, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 52 },
  { slug: 'dsip-15mg', name: 'DSIP', category: 'Nootropic', size: '15mg', price: 297, bulkPrice5: 276, bulkPrice10: 267, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 89 },
  { slug: 'cerebrolysin-60mg', name: 'Cerebrolysin (6 vials)', category: 'Nootropic', size: '60mg', price: 144, bulkPrice5: 123, bulkPrice10: 114, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 43 },
  { slug: 'vip5-5mg', name: 'VIP5', category: 'Nootropic', size: '5mg', price: 270, bulkPrice5: 249, bulkPrice10: 240, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 81 },
  { slug: 'vip10-10mg', name: 'VIP10', category: 'Nootropic', size: '10mg', price: 432, bulkPrice5: 411, bulkPrice10: 402, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 130 },
  { slug: 'ara-290-10mg', name: 'Ara-290', category: 'Neuroprotective', size: '10mg', price: 240, bulkPrice5: 219, bulkPrice10: 210, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 72 },

  // ── Cosmetic ──────────────────────────────────────────────────────────────
  { slug: 'snap-8-10mg', name: 'Snap-8', category: 'Cosmetic Peptide', size: '10mg', price: 174, bulkPrice5: 153, bulkPrice10: 144, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 52 },
  { slug: 'lemon-bottle-10ml', name: 'Lemon Bottle', category: 'Cosmetic Peptide', size: '10ml', price: 285, bulkPrice5: 264, bulkPrice10: 255, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 86 },
  { slug: 'botulinum-toxin-100mg', name: 'Botulinum Toxin', category: 'Cosmetic Peptide', size: '100mg', price: 435, bulkPrice5: 414, bulkPrice10: 405, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 131 },

  // ── Lipolytic / LC ────────────────────────────────────────────────────────
  { slug: 'lc120-10ml', name: 'LC120', category: 'Lipolytic', size: '10ml', price: 240, bulkPrice5: 219, bulkPrice10: 210, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 72 },
  { slug: 'lc216-10ml', name: 'LC216', category: 'Lipolytic', size: '10ml', price: 285, bulkPrice5: 264, bulkPrice10: 255, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 86 },
  { slug: 'lc-custom', name: 'LC Custom Ingredients', category: 'Lipolytic', size: 'custom', price: 273, bulkPrice5: 252, bulkPrice10: 243, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 82 },

  // ── Research / Exercise Mimetics ──────────────────────────────────────────
  { slug: 'slu-pp-332-5mg', name: 'SLU-PP-332', category: 'Exercise Mimetic', size: '5mg', price: 339, bulkPrice5: 318, bulkPrice10: 309, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 102 },
  { slug: '5-amino-1mq-5mg', name: '5-Amino-1MQ', category: 'NAMPT Inhibitor', size: '5mg', price: 129, bulkPrice5: 108, bulkPrice10: 99, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 39 },
  { slug: '5-amino-1mq-10mg', name: '5-Amino-1MQ', category: 'NAMPT Inhibitor', size: '10mg', price: 174, bulkPrice5: 153, bulkPrice10: 144, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 52 },
  { slug: '5-amino-1mq-50mg', name: '5-Amino-1MQ', category: 'NAMPT Inhibitor', size: '50mg', price: 264, bulkPrice5: 243, bulkPrice10: 234, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 79 },
  { slug: 'pnc-27-5mg', name: 'PNC 27', category: 'Anti-Tumor', size: '5mg', price: 297, bulkPrice5: 276, bulkPrice10: 267, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 89 },
  { slug: 'pnc-27-10mg', name: 'PNC 27', category: 'Anti-Tumor', size: '10mg', price: 492, bulkPrice5: 471, bulkPrice10: 462, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 148 },
  { slug: 'g610-10mg', name: 'G610', category: 'Research Compound', size: '10mg', price: 162, bulkPrice5: 141, bulkPrice10: 132, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 49 },

  // ── Vitamins ──────────────────────────────────────────────────────────────
  { slug: 'b12-10ml', name: 'B12 1mg/ml', category: 'Vitamin', size: '10ml', price: 144, bulkPrice5: 123, bulkPrice10: 114, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 43 },

  // ── Reconstitution ────────────────────────────────────────────────────────
  { slug: 'bac-water-3ml', name: 'BAC Water', category: 'Reconstitution', size: '3ml', price: 24, bulkPrice5: 24, bulkPrice10: 21, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 7 },
  { slug: 'bac-water-10ml', name: 'BAC Water', category: 'Reconstitution', size: '10ml', price: 45, bulkPrice5: 45, bulkPrice10: 39, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 14 },
  { slug: 'ga-water-3ml', name: 'GA = AA Water', category: 'Reconstitution', size: '3ml', price: 42, bulkPrice5: 42, bulkPrice10: 39, imageUrl: '/images/ALL.png', badge: null, costOfGoods: 13 },
]

// Add description to all products
const productsWithDescriptions = products.map(p => ({
  ...p,
  description: `${p.name} ${p.size} — For Research Use Only. Independently verified purity ≥98%. Not for human use, consumption, or therapeutic application.`,
}))

async function main() {
  console.log(`Seeding ${productsWithDescriptions.length} products...`)
  for (const p of productsWithDescriptions) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    })
    console.log(`  ✓ ${p.name} ${p.size}`)
  }
  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
