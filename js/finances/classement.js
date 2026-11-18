// Classement automatique d'une opération bancaire. Ordre : mes règles (apprises de mes corrections), puis les règles d'Élan,
// puis la catégorie donnée par la banque. Fonction pure : testée hors de l'application.

// Nom du commerçant, sans « CB », sans « du 12/11 », sans numéro de carte : sert de clé pour les règles apprises.
export function cleMarchand(lib){
  return String(lib || '').toLowerCase()
    .replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi')
    .replace(/^cb\s+(de\s+)?/, '').replace(/\s+du\s+\d\d\/\d\d.*$/, '').replace(/\*+\d+\*?/g, '')
    .replace(/^du \d{6} /, '').replace(/\s+carte.*$/, '')
    .replace(/[^a-z0-9àâäçéèêëîïôöùûüœ&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// [motif, groupe, sous-catégorie]. Le premier motif qui correspond gagne.
const REGLES = [
  [/gerance de france|sas gerance/, 'fixes', 'loyer'],
  [/c\.?\s?e\.?\s?p\.?\s?e\.?\s?c\b/, 'etudes', 'scolarite'],
  [/decathlon france|nike retail/, 'entrees', 'salaire'],
  [/caf du rhone|caf du /, 'entrees', 'caf'],
  [/france travail|notprovided/, 'entrees', 'aides'],
  [/mangopay|vinted/, 'entrees', 'ventes'],
  [/maif/, 'fixes', 'assurance'],
  [/tcl 69|spl ?ru|velov|vélo'v|velo'v/, 'fixes', 'transport'],
  [/wombat brotteaux|on ?air|jln onair/, 'fixes', 'sport'],
  [/anthropic|claude\.ai/, 'fixes', 'abonnements'],
  [/^orange|^sfr|lycamobile|sosh|sfrenlign/, 'fixes', 'telephone'],
  [/amazon prime|amz digital|google ?workspac|google\*|ovh|apple\.com|^apple$|netflix|spotify/, 'fixes', 'abonnements'],
  [/commissions|cotisation|int[ée]r[êe]ts debiteurs|frais/, 'fixes', 'banque'],
  [/onlyfans|^of$|nextcam|fanvue|segpay/, 'plaisirs', 'adultes'],
  [/deliveroo|uber ?eats|just ?eat/, 'plaisirs', 'deliveroo'],
  [/shotgun|xceed|yurplan|yapluka|transbordeur|bolt|beer king|babylone|mos pub|ninkasi|brasserie|esprit malte|les terrasses|area 51|barabaar|sound factory|crouslyon|halle garnie|play in park|lyon loisirs|ugc|pathe|avenue 45|vigne palmyre|cafe des capuci|magistra|expresso|^tank|gld lyon|ficucial|la marinade|leetchi|bpay global|sumup/, 'plaisirs', 'sorties'],
  [/tabac|osum|cricli|alber johne/, 'plaisirs', 'tabac'],
  [/binance|bifinity|coinbase|kraken/, 'trading', 'crypto'],
  [/ftmo|topstep|funded|apex trader|the5ers/, 'trading', 'challenges'],
  [/runpod|wavespeed|linkscale|infloww|vast\.?\s?ai|skool|contentmagic|grok|xai|claritycheck|fal features|infinni|patreon|weights|mail boxes|^ppg$/, 'business', 'outils'],
  [/fournil|boulangerie|marie bla|jules vitton|chez jules|delices|croissant show|peche mignon|mokamatic|ivs france|tacos|subway|pretamanger|chicken|poulet|mcdonald|bk part|burger|kebab|sandwi|o grill|eat drink|sarl mb|cs villeurbanne|la fraiche|snc badel|sarl yalda|copper|conflutime|^sb |carl s|food house|belly|jnd carre|pignol|cusset|vivants|lyon d or|cigkoftem|eker|chamas|kfc|o'tacos|pizza/, 'plaisirs', 'snacks'],
  [/lidl|hyper u|super u|carrefour|grand frais|^mbc|u express|intermarch|casino|epicerie|^metro|leaf market|flachet|gratte|mpl\*ha|calao|sarl celep|maison janna|arici|neamah|nya\*bda|pani cbs|auchan|monoprix|franprix|aldi|picard/, 'courses', 'courses'],
  [/h&m|bershka|zara|uniqlo|jules|celio|nike|adidas|jd sports|cordonnerie|kiabi|primark/, 'durables', 'vetements'],
  [/fnac|darty|boulanger|apple store|ldlc|back market/, 'durables', 'hightech'],
  [/decathlon|intersport|go sport|inshape/, 'durables', 'sport'],
  [/leroy merlin|ikea|castorama|maisons du monde|action/, 'durables', 'maison'],
  [/cultura|gibert|librairie|decitre/, 'durables', 'livres'],
  [/klarna|paypal|temu|^amazon$|le bazar|mobile locker|petit salon|sncf|blablacar|ouigo/, 'imprevus', 'achats'],
  [/fondation|frm |unicef|croix rouge|restos du coeur/, 'imprevus', 'dons'],
  [/pharmacie|docteur|medecin|dentiste|optic/, 'imprevus', 'sante'],
  [/laposte|la poste|photocopi|ants|prefecture/, 'imprevus', 'admin'],
];

// Repli sur la catégorie de la banque quand aucune règle ne correspond.
const BANQUE = {
  'alimentation, supermarché': ['courses', 'courses'],
  'restaurants, bars': ['plaisirs', 'snacks'],
  'taxi, vtc': ['plaisirs', 'sorties'],
  'divertissements, sorties culturelles': ['plaisirs', 'sorties'],
  'loisirs et sorties - autres': ['plaisirs', 'sorties'],
  'tabac, presse': ['plaisirs', 'tabac'],
  'transports en commun': ['fixes', 'transport'],
  'stationnement': ['fixes', 'transport'],
  'téléphone': ['fixes', 'telephone'],
  'internet, tv': ['fixes', 'abonnements'],
  'frais bancaires': ['fixes', 'banque'],
  'loyer': ['fixes', 'loyer'], 'loyers': ['fixes', 'loyer'],
  'aides et allocations': ['entrees', 'aides'],
  'habillement': ['durables', 'vetements'],
  'achat multimédia, high-tech': ['durables', 'hightech'],
  'bricolage et jardinage': ['durables', 'maison'],
  'musique, livres, films': ['durables', 'livres'],
  'sport': ['durables', 'sport'],
  'cadeaux': ['imprevus', 'achats'],
  'coiffeur, cosmétique, soins': ['imprevus', 'achats'],
  'frais postaux': ['imprevus', 'admin'],
};

const contient = (texte, mots) => (mots || []).some(m => m && texte.includes(String(m).toLowerCase()));

// op : { lib, montant, banque? } ; reglages : { noms: { moi, frere, famille, comptes }, retraitsPrives }, reglesPerso : [{ motif, groupe, sous }]
// Renvoie { groupe, sous, verif } ; verif = à vérifier par moi.
export function classer(op, reglages = {}, reglesPerso = []){
  const lib = String(op.lib || '').toLowerCase().replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi');
  const cle = cleMarchand(op.lib);
  const noms = reglages.noms || {};
  const m = Number(op.montant) || 0;

  for(const r of reglesPerso){
    if(r && r.motif && (cle === r.motif || cle.startsWith(r.motif + ' ') || lib.includes(r.motif))) return { groupe: r.groupe, sous: r.sous, verif: false, regle: r.motif };
  }

  // Retraits d'espèces : les montants « privés » (20, 30, 40 € par défaut) vont dans le privé.
  if(/^retrait/.test(lib)){
    const prives = reglages.retraitsPrives || [20, 30, 40];
    if(prives.includes(Math.abs(Math.round(m * 100) / 100))) return { groupe: 'plaisirs', sous: 'weed', verif: false };
    return { groupe: 'imprevus', sous: 'divers', verif: true };
  }
  if(/^dépôt|^depot/.test(lib)) return { groupe: 'entrees', sous: 'autres', verif: false };

  // Virements de personne à personne.
  if(/^virement (à|a|de|vers) /.test(lib) || /^virement /.test(lib)){
    if(/^virement (de|reçu)/.test(lib) || m > 0){
      if(contient(lib, noms.moi)) return { groupe: 'interne', sous: 'transfert', verif: false };
      for(const r of REGLES.slice(0, 7)) if(r[0].test(cle) || r[0].test(lib)) return { groupe: r[1], sous: r[2], verif: false };
    }
    if(contient(lib, noms.moi)) return { groupe: 'interne', sous: 'transfert', verif: false };
    if(contient(lib, noms.frere)) return { groupe: 'proches', sous: 'frere', verif: false };
    if(contient(lib, noms.famille)) return { groupe: 'entrees', sous: 'famille', verif: false };
    for(const r of REGLES) if(r[0].test(cle) || r[0].test(lib)) return { groupe: r[1], sous: r[2], verif: false };
    return { groupe: 'imprevus', sous: 'amis', verif: false };
  }
  if(/^cb de /.test(lib) || /remboursement/.test(String(op.banque || '').toLowerCase())) {
    for(const r of REGLES) if(r[0].test(cle) || r[0].test(lib)) return { groupe: r[1], sous: r[2], verif: false };
    return { groupe: 'imprevus', sous: 'achats', verif: false };
  }
  if(contient(lib, noms.comptes) || /^cb revolut|^revolut|top-up|recharge|top up/.test(cle)) return { groupe: 'interne', sous: 'transfert', verif: false };

  for(const r of REGLES) if(r[0].test(cle) || r[0].test(lib)) return { groupe: r[1], sous: r[2], verif: false };

  const b = BANQUE[String(op.banque || '').toLowerCase().trim()];
  if(b) return { groupe: b[0], sous: b[1], verif: b[0] === 'durables' };
  if(m > 0) return { groupe: 'entrees', sous: 'autres', verif: true };
  return { groupe: 'imprevus', sous: 'divers', verif: true };
}

// Sous-catégories proposées comme bêtises (je décide toujours à la fin).
export const BETISES_PROBABLES = new Set(['plaisirs:snacks', 'plaisirs:deliveroo', 'plaisirs:adultes']);
