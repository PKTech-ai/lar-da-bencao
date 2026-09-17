export type ModuleDef = {
  key: string;
  href: string;
  label: string;
  flagKey: string;
  permissionResource: string;
  department?: string;
};

/** Catálogo de módulos da onda 1 (paridade mínima com o mock v215). */
export const moduleCatalog: ModuleDef[] = [
  { key: "home", href: "/sistema", label: "Visão Geral", flagKey: "module_home_ops", permissionResource: "dashboard" },
  { key: "documentos", href: "/sistema/documentos", label: "Estatuto e Regimento", flagKey: "module_documentos", permissionResource: "institucional" },
  { key: "trabalhadores", href: "/sistema/trabalhadores", label: "Trabalhadores", flagKey: "module_workers", permissionResource: "department" },
  { key: "admissoes", href: "/sistema/admissoes", label: "Admissões", flagKey: "module_workers", permissionResource: "department" },
  { key: "doutrina", href: "/sistema/doutrina", label: "Doutrina", flagKey: "module_doutrina", permissionResource: "department", department: "doutrina" },
  { key: "infancia", href: "/sistema/infancia", label: "Infância", flagKey: "module_infancia", permissionResource: "department", department: "infancia" },
  { key: "juventude", href: "/sistema/juventude", label: "Juventude", flagKey: "module_juventude", permissionResource: "department", department: "juventude" },
  { key: "patrimonio", href: "/sistema/patrimonio", label: "Patrimônio", flagKey: "module_patrimonio", permissionResource: "department", department: "patrimonio" },
  { key: "presidencia", href: "/sistema/presidencia", label: "Presidência", flagKey: "module_presidencia", permissionResource: "presidencia" }
];

export const doutrinaSubnav = [
  { href: "/sistema/doutrina/trabalhadores", label: "Trabalhadores" },
  { href: "/sistema/doutrina/palestrantes", label: "Palestrantes Externos" },
  { href: "/sistema/doutrina/estudos", label: "Biblioteca de Estudos" },
  { href: "/sistema/doutrina/escalas", label: "Escala Mensal" },
  { href: "/sistema/doutrina/frequencia", label: "Frequência" },
  { href: "/sistema/doutrina/culto-lar", label: "Culto no Lar" }
] as const;
