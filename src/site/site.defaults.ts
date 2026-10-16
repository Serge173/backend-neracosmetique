export type FieldKind = 'text' | 'multiline' | 'email' | 'phone' | 'url';

/** Informations de la boutique modifiables depuis l'admin : clé → type et longueur maximale. */
export const SETTINGS_SPEC: Record<string, { kind: FieldKind; max: number }> = {
  storeName: { kind: 'text', max: 80 },
  tagline: { kind: 'text', max: 160 },
  email: { kind: 'email', max: 120 },
  phone: { kind: 'phone', max: 30 },
  whatsapp: { kind: 'phone', max: 30 },
  responseTime: { kind: 'text', max: 160 },
  openingHours: { kind: 'multiline', max: 400 },
  address: { kind: 'text', max: 200 },
  city: { kind: 'text', max: 80 },
  country: { kind: 'text', max: 80 },
  mapQuery: { kind: 'text', max: 200 },
  facebook: { kind: 'url', max: 300 },
  instagram: { kind: 'url', max: 300 },
  tiktok: { kind: 'url', max: 300 },
  twitter: { kind: 'url', max: 300 },
  snapchat: { kind: 'url', max: 300 },
  youtube: { kind: 'url', max: 300 },
  legalName: { kind: 'text', max: 120 },
  legalForm: { kind: 'text', max: 80 },
  capital: { kind: 'text', max: 80 },
  rccm: { kind: 'text', max: 60 },
  ncc: { kind: 'text', max: 60 },
  headOffice: { kind: 'text', max: 200 },
  director: { kind: 'text', max: 120 },
  hostInfo: { kind: 'multiline', max: 400 },
};

export type SiteSettings = Record<keyof typeof SETTINGS_SPEC, string>;

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'Nera Cosmétique',
  tagline: 'Produits cosmétiques importés de France',
  email: 'skeayeni@gmail.com',
  phone: '+225 07 89 68 44 67',
  whatsapp: '+225 07 89 68 44 67',
  responseTime: 'Réponse sous 24 à 48 h ouvrées.',
  openingHours: '',
  address: '',
  city: 'Abidjan',
  country: "Côte d'Ivoire",
  mapQuery: "Abidjan, Côte d'Ivoire",
  facebook: 'https://www.facebook.com/neracosmetique',
  instagram: 'https://www.instagram.com/neracosmetique',
  tiktok: 'https://www.tiktok.com/@neracosmetique',
  twitter: 'https://twitter.com/neracosmetique',
  snapchat: 'https://www.snapchat.com/add/neracosmetique',
  youtube: '',
  legalName: 'Nera Cosmétique',
  legalForm: '',
  capital: '',
  rccm: '',
  ncc: '',
  headOffice: '',
  director: '',
  hostInfo: 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com',
};

export type PageKind = 'about' | 'legal';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalContent {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface AboutContent {
  heroLabel: string;
  heroTitle: string;
  heroTagline: string;
  storyLabel: string;
  storyTitle: string;
  storyLead: string;
  storyBody: string;
  imageUrl: string;
  imageBadge: string;
  missionTitle: string;
  missionText: string;
  visionTitle: string;
  visionText: string;
  commitmentsLabel: string;
  commitmentsTitle: string;
  commitments: { title: string; text: string }[];
  ctaTitle: string;
  ctaText: string;
}

export const ABOUT_LIMITS: Record<Exclude<keyof AboutContent, 'commitments'>, number> = {
  heroLabel: 60,
  heroTitle: 120,
  heroTagline: 300,
  storyLabel: 60,
  storyTitle: 160,
  storyLead: 600,
  storyBody: 4000,
  imageUrl: 500,
  imageBadge: 40,
  missionTitle: 80,
  missionText: 800,
  visionTitle: 80,
  visionText: 800,
  commitmentsLabel: 60,
  commitmentsTitle: 120,
  ctaTitle: 160,
  ctaText: 400,
};

export const PAGES: Record<string, { kind: PageKind; label: string }> = {
  'a-propos': { kind: 'about', label: 'À propos' },
  cgv: { kind: 'legal', label: 'Conditions générales de vente' },
  'politique-confidentialite': { kind: 'legal', label: 'Politique de confidentialité' },
  retours: { kind: 'legal', label: 'Politique de retour' },
  'mentions-legales': { kind: 'legal', label: 'Mentions légales' },
};

export const DEFAULT_ABOUT: AboutContent = {
  heroLabel: 'Notre histoire',
  heroTitle: 'Nera Cosmétique',
  heroTagline: "La beauté authentique, importée de France pour la Côte d'Ivoire.",
  storyLabel: 'Qui sommes-nous',
  storyTitle: 'Une passion devenue projet',
  storyLead:
    "Nera Cosmétique est née de l'envie d'offrir aux femmes ivoiriennes un accès simple et fiable aux meilleurs soins et cosmétiques français.",
  storyBody:
    "Convaincus que la qualité ne doit pas être un luxe réservé à quelques-uns, nous sélectionnons avec soin des marques reconnues et des produits authentiques, importés directement de France. Chaque article que nous proposons répond à des critères stricts : formulation sûre, efficacité prouvée et traçabilité garantie.\n\nAujourd'hui, Nera Cosmétique s'impose comme un partenaire de confiance pour prendre soin de sa peau et de son bien-être au quotidien, partout en Côte d'Ivoire.",
  imageUrl: '/assets/images/im2.jpeg',
  imageBadge: 'Import France',
  missionTitle: 'Notre mission',
  missionText:
    "Proposer une gamme de cosmétiques et soins d'origine française, authentiques et accessibles, pour que chaque cliente puisse prendre soin d'elle en toute confiance.",
  visionTitle: 'Notre vision',
  visionText:
    "Devenir la référence du cosmétique français en Côte d'Ivoire, en alliant qualité des produits, transparence et un service client à l'écoute de vos besoins.",
  commitmentsLabel: 'Ce qui nous engage',
  commitmentsTitle: 'Nos engagements',
  commitments: [
    {
      title: 'Produits 100% importés de France',
      text: 'Chaque produit est sourcé auprès de fournisseurs et marques français reconnus. Aucune contrefaçon, aucune provenance floue.',
    },
    {
      title: 'Qualité et traçabilité',
      text: "Formulations contrôlées, ingrédients identifiés. Nous privilégions les marques qui partagent nos exigences en matière de sécurité et d'efficacité.",
    },
    {
      title: 'Service client réactif',
      text: 'Une équipe disponible pour répondre à vos questions sur les produits, les commandes et la livraison. Votre satisfaction guide nos priorités.',
    },
    {
      title: "Livraison en Côte d'Ivoire",
      text: "Livraison rapide et soignée à Abidjan et à l'intérieur du pays. Colis protégés pour que vos produits arrivent dans les meilleures conditions.",
    },
  ],
  ctaTitle: 'Prête à découvrir notre sélection ?',
  ctaText: 'Parcourez notre boutique ou contactez-nous pour toute question.',
};

export const DEFAULT_LEGAL: Record<string, LegalContent> = {
  cgv: {
    title: 'Conditions générales de vente',
    intro:
      "Les présentes conditions régissent les ventes réalisées sur le site {boutique}. Toute commande implique leur acceptation sans réserve.",
    sections: [
      {
        heading: 'Objet',
        body: "Les présentes conditions générales de vente (CGV) définissent les droits et obligations de {boutique} et de ses clients pour tout achat de produits cosmétiques effectué sur le site.",
      },
      {
        heading: 'Produits',
        body: "Les produits proposés sont des cosmétiques et soins importés de France. Leurs caractéristiques essentielles (description, composition lorsqu'elle est communiquée par la marque, contenance) figurent sur chaque fiche produit.\n\nLes photos sont aussi fidèles que possible mais n'ont pas de valeur contractuelle. Les offres sont valables dans la limite des stocks disponibles.",
      },
      {
        heading: 'Prix',
        body: "Les prix sont indiqués en francs CFA (F CFA), toutes taxes comprises. Les frais de livraison sont affichés avant la validation de la commande et s'ajoutent au prix des produits.\n\n{boutique} se réserve le droit de modifier ses prix à tout moment ; les produits sont facturés au prix en vigueur au moment de la validation de la commande.",
      },
      {
        heading: 'Commande',
        body: "Pour commander, le client ajoute les produits à son panier, renseigne ses coordonnées de livraison puis valide sa commande. Un récapitulatif lui est présenté avant la validation définitive.\n\n{boutique} peut contacter le client par téléphone ou WhatsApp pour confirmer la commande. Une commande peut être annulée en cas d'informations incomplètes, d'indisponibilité d'un produit ou de suspicion de fraude ; le client en est alors informé.",
      },
      {
        heading: 'Paiement',
        body: "Le paiement s'effectue à la livraison, en espèces, au moment de la remise du colis. D'autres moyens de paiement (Mobile Money) pourront être proposés ; ils seront alors indiqués lors de la commande.",
      },
      {
        heading: 'Livraison',
        body: "Les livraisons sont effectuées en Côte d'Ivoire, à Abidjan et à l'intérieur du pays, à l'adresse indiquée par le client. Les délais indicatifs et les tarifs dépendent de la zone de livraison et sont précisés lors de la commande.\n\nLe client vérifie l'état du colis à la réception. Tout colis endommagé ou incomplet doit être signalé immédiatement au livreur et à notre service client.",
      },
      {
        heading: 'Retours et réclamations',
        body: "Les conditions de retour et d'échange sont détaillées dans notre politique de retour, accessible depuis le bas de chaque page du site. Pour toute réclamation, contactez-nous par e-mail à {email} ou sur WhatsApp au {whatsapp}.",
      },
      {
        heading: 'Responsabilité',
        body: "Les produits cosmétiques doivent être utilisés conformément à leurs instructions. En cas de peau sensible ou d'allergie connue, il est recommandé d'effectuer un test préalable sur une petite zone. {boutique} ne saurait être tenue responsable d'une utilisation non conforme des produits.",
      },
      {
        heading: 'Données personnelles',
        body: 'Les informations recueillies lors de la commande sont nécessaires à son traitement. Leur utilisation est décrite dans notre politique de confidentialité.',
      },
      {
        heading: 'Droit applicable',
        body: "Les présentes CGV sont soumises au droit ivoirien. En cas de litige, une solution amiable sera recherchée en priorité avant toute action devant les juridictions compétentes de Côte d'Ivoire.",
      },
    ],
  },
  'politique-confidentialite': {
    title: 'Politique de confidentialité',
    intro:
      "{boutique} accorde une grande importance à la protection de vos données personnelles. Cette page explique quelles données nous collectons, pourquoi, et quels sont vos droits.",
    sections: [
      {
        heading: 'Données collectées',
        body: "Nous collectons uniquement les données nécessaires à nos services :\n- votre identité : prénom et nom ;\n- vos coordonnées : e-mail, téléphone et adresses de livraison ;\n- vos commandes, favoris, avis et points de fidélité ;\n- les messages que vous nous envoyez via le formulaire de contact.",
      },
      {
        heading: 'Utilisation des données',
        body: "Vos données servent à :\n- traiter et livrer vos commandes ;\n- gérer votre compte client et votre programme de fidélité ;\n- répondre à vos questions et demandes ;\n- vous envoyer notre newsletter, uniquement si vous y êtes inscrit(e).",
      },
      {
        heading: 'Partage des données',
        body: "Vos données ne sont jamais vendues. Elles sont transmises uniquement aux prestataires nécessaires à nos services (livraison, hébergement du site), et dans la stricte limite de leur mission.",
      },
      {
        heading: 'Durée de conservation',
        body: "Vos données sont conservées pendant la durée de votre relation avec {boutique}, puis pendant la durée imposée par nos obligations légales et comptables.",
      },
      {
        heading: 'Sécurité',
        body: "Votre mot de passe est chiffré et n'est jamais lisible, même par notre équipe. Les échanges avec le site sont protégés par une connexion sécurisée (HTTPS) et l'accès aux données est réservé aux personnes habilitées.",
      },
      {
        heading: 'Cookies et stockage local',
        body: "Le site utilise uniquement le stockage nécessaire à son fonctionnement : maintien de votre connexion, contenu de votre panier et préférences. Aucun cookie publicitaire n'est utilisé.",
      },
      {
        heading: 'Vos droits',
        body: "Conformément à la loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel, vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de vos données.\n\nVous pouvez modifier vos informations depuis votre espace client, ou exercer vos droits en nous écrivant à {email}.",
      },
    ],
  },
  retours: {
    title: 'Politique de retour',
    intro:
      "Votre satisfaction est notre priorité. Si un produit ne vous convient pas ou présente un problème, voici comment nous pouvons vous aider.",
    sections: [
      {
        heading: 'Produit endommagé, défectueux ou erroné',
        body: "Si vous recevez un produit abîmé, défectueux ou différent de votre commande, signalez-le dans les 48 heures suivant la livraison, avec des photos du produit et de l'emballage :\n- sur WhatsApp au {whatsapp} ;\n- ou par e-mail à {email}.\n\nAprès vérification, nous vous proposons un échange ou un remboursement, sans frais pour vous.",
      },
      {
        heading: 'Produit non ouvert',
        body: "Un produit qui ne vous convient pas peut être retourné dans les 7 jours suivant la livraison, à condition qu'il soit neuf, non ouvert, non utilisé et dans son emballage d'origine scellé. Contactez-nous avant tout retour pour convenir des modalités.\n\nDans ce cas, les frais de retour restent à votre charge, sauf accord contraire.",
      },
      {
        heading: 'Produits non repris',
        body: "Pour des raisons d'hygiène et de sécurité, les produits ouverts, entamés ou dont l'emballage scellé a été retiré ne peuvent être ni repris ni échangés, sauf en cas de défaut.",
      },
      {
        heading: 'Remboursement',
        body: "Une fois le retour reçu et vérifié, le remboursement est effectué dans un délai de 7 jours ouvrés, par le moyen convenu avec notre service client (espèces, Mobile Money ou avoir).",
      },
      {
        heading: 'Nous contacter',
        body: 'Notre équipe est disponible pour répondre à toutes vos questions sur un retour : WhatsApp au {whatsapp}, téléphone au {telephone} ou e-mail à {email}.',
      },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    intro: "Informations légales relatives au site {boutique}.",
    sections: [
      {
        heading: 'Propriété intellectuelle',
        body: "L'ensemble des contenus du site (textes, logos, visuels, mise en page) est protégé. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite préalable de {boutique} est interdite.\n\nLes marques et visuels des produits restent la propriété de leurs titulaires respectifs.",
      },
      {
        heading: 'Responsabilité',
        body: "{boutique} s'efforce de fournir des informations exactes et à jour, mais ne peut garantir l'absence d'erreurs. Les liens vers des sites extérieurs sont fournis à titre informatif ; {boutique} n'est pas responsable de leur contenu.",
      },
      {
        heading: 'Données personnelles',
        body: 'Le traitement de vos données personnelles est détaillé dans notre politique de confidentialité.',
      },
      {
        heading: 'Contact',
        body: 'Pour toute question concernant le site, écrivez-nous à {email} ou contactez-nous sur WhatsApp au {whatsapp}.',
      },
    ],
  },
};

export const LEGAL_LIMITS = { title: 120, intro: 1200, heading: 160, body: 6000, sections: 30 };
