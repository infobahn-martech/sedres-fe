export const PORT_DETAILS = [
  {
    name: "Dammam Port",
    city: "Dammam, KSA",
    phoneNumber: "+966135000001",
    email: "dammam.port@sedres.com",
  },
  {
    name: "Al Jubail Commercial Sea Port",
    city: "Al Jubail, KSA",
    phoneNumber: "+966133300002",
    email: "aljubail.port@sedres.com",
  },
  {
    name: "Ras Tanura Refinery",
    city: "Ras Tanura, KSA",
    phoneNumber: "+966136600003",
    email: "rastanura.refinery@sedres.com",
  },
  {
    name: "Al Khafji Port",
    city: "Al Khafji, KSA",
    phoneNumber: "+966137700004",
    email: "alkhafji.port@sedres.com",
  },
  {
    name: "As Safaniya Port",
    city: "As Safaniya, KSA",
    phoneNumber: "+966138800005",
    email: "assafaniya.port@sedres.com",
  },
];

export const PORT_OPTIONS = PORT_DETAILS.map(({ name }) => name);

export const PORT_OPTIONS_WITH_ID = PORT_DETAILS.map((p, i) => ({
  id: i + 1,
  name: p.name,
}));

