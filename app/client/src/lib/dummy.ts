import type { FacilityListItem, FacilityDetail, TrustSignal, UserAction, ReviewCard, ReviewStatus } from "../types";

const NOW = new Date().toISOString();

function sig(
  facility_id: string,
  dimension: string,
  trust_score: string | null,
  confidence_tier: string,
  evidence_text: string | null,
  source_field: string | null,
  contradiction: boolean,
  contradiction_detail: string | null,
): TrustSignal {
  return {
    id: Math.floor(Math.random() * 90000) + 10000,
    facility_id,
    dimension,
    trust_score,
    confidence_tier,
    evidence_text,
    source_field,
    contradiction,
    contradiction_detail,
    extraction_model: "databricks-meta-llama-3-1-70b-instruct",
    extracted_at: NOW,
  };
}

export const DUMMY_DETAILS: Record<string, FacilityDetail> = {
  "fac-001": {
    facility: {
      facility_id: "fac-001",
      facility_name: "Apollo Hospitals - Hyderabad",
      facility_type: "Hospital",
      state: "Telangana",
      district: "Hyderabad",
      description: "Multi-specialty tertiary care hospital with advanced cardiac, oncology, and transplant units. JCI and NABH accredited.",
      capability: "Cardiac surgery, oncology, neurosurgery, organ transplant, critical care",
      procedure: "Coronary bypass, chemotherapy, MRI-guided biopsy, liver transplant",
      equipment: "3T MRI, 256-slice CT, robotic surgery system, PET scanner",
      capacity: 710,
      year_established: 1988,
      official_phone: "+91 40 2360 7777",
      email: "info@apollohospitals.com",
      official_website: null,
      address_line1: "Jubilee Hills, Hyderabad, Telangana 500033",
      number_doctors: 250,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-001", "capability", "0.88", "high", "Cardiac surgery, oncology, neurosurgery, organ transplant, critical care departments all listed with dedicated ICUs.", "capability", false, null),
      sig("fac-001", "equipment", "0.82", "high", "3T MRI, 256-slice CT, robotic surgery system, PET scanner — all high-specificity clinical equipment.", "equipment", false, null),
      sig("fac-001", "procedure", "0.79", "medium", "Coronary bypass, chemotherapy, MRI-guided biopsy, liver transplant — complex procedures with established protocols.", "procedure", false, null),
      sig("fac-001", "completeness", null, "insufficient_data", "capacity (710 beds) available but year_established field has only 48% dataset coverage; score suppressed.", "capacity", false, null),
    ],
  },
  "fac-002": {
    facility: {
      facility_id: "fac-002",
      facility_name: "Government District Hospital, Kurnool",
      facility_type: "Hospital",
      state: "Andhra Pradesh",
      district: "Kurnool",
      description: "District government hospital serving rural populations. General medicine, surgery, and maternity. Equipment roster limited.",
      capability: "General medicine, surgery, maternity, paediatrics",
      procedure: "Normal delivery, appendectomy, minor surgeries",
      equipment: "X-ray, ultrasound, basic lab",
      capacity: 200,
      year_established: 1965,
      official_phone: "+91 8518 222 200",
      email: null,
      official_website: null,
      address_line1: "Bellary Road, Kurnool, Andhra Pradesh 518002",
      number_doctors: 45,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-002", "capability", "0.52", "medium", "General medicine, surgery, maternity, paediatrics — standard district hospital scope with no specialty units listed.", "capability", false, null),
      sig("fac-002", "equipment", "0.38", "low", "X-ray, ultrasound, basic lab — minimal imaging; no CT or MRI listed. Equipment text is sparse.", "equipment", false, null),
      sig("fac-002", "procedure", "0.45", "medium", "Normal delivery, appendectomy, minor surgeries — routine procedures only, no complex interventional data.", "procedure", false, null),
      sig("fac-002", "completeness", null, "insufficient_data", "capacity (200 beds) recorded. year_established field coverage insufficient to score completeness reliably.", "capacity", false, null),
    ],
  },
  "fac-003": {
    facility: {
      facility_id: "fac-003",
      facility_name: "Fortis Malar Hospital",
      facility_type: "Hospital",
      state: "Tamil Nadu",
      district: "Chennai",
      description: "Quaternary care hospital specialising in cardiac sciences and critical care. Free text claims 400-bed capacity but structured field records 180.",
      capability: "Cardiology, cardiac surgery, critical care, emergency medicine",
      procedure: "Angioplasty, CABG, ECMO, heart failure management",
      equipment: "Cath lab (2 units), ECMO, 128-slice CT, digital angiography",
      capacity: 180,
      year_established: 1992,
      official_phone: "+91 44 4211 8181",
      email: "info@fortismalar.com",
      official_website: null,
      address_line1: "No.52, 1st Main Road, Gandhi Nagar, Chennai 600020",
      number_doctors: 120,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-003", "capability", "0.85", "high", "Cardiology, cardiac surgery, critical care, emergency medicine — coherent quaternary cardiac centre profile.", "capability", false, null),
      sig("fac-003", "equipment", "0.81", "high", "Cath lab (2 units), ECMO, 128-slice CT, digital angiography — all equipment consistent with advanced cardiac care.", "equipment", false, null),
      sig("fac-003", "procedure", "0.77", "medium", "Angioplasty, CABG, ECMO — procedures match equipment list. Heart failure management is vague but plausible.", "procedure", false, null),
      sig("fac-003", "completeness", "0.41", "low", "Structured capacity = 180 beds but free text states '400-bed facility'. Contradiction reduces completeness confidence.", "capacity", true, "Structured field records 180 beds; description text states '400-bed facility'. Do not rely on the capacity figure without verification."),
    ],
  },
  "fac-004": {
    facility: {
      facility_id: "fac-004",
      facility_name: "Manipal Hospital, Bengaluru",
      facility_type: "Hospital",
      state: "Karnataka",
      district: "Bengaluru Urban",
      description: "NABH-accredited multi-specialty hospital. Comprehensive oncology, neurosciences, and orthopedics. Claims MRI availability but equipment field lists only CT and X-ray.",
      capability: "Oncology, neurosciences, orthopedics, gastroenterology, nephrology",
      procedure: "Chemotherapy, spine surgery, joint replacement, dialysis",
      equipment: "CT scanner, X-ray, ultrasound, mammography",
      capacity: 600,
      year_established: 1991,
      official_phone: "+91 80 2222 2222",
      email: "bangalore@manipalhospitals.com",
      official_website: null,
      address_line1: "98, HAL Airport Road, Bengaluru 560017",
      number_doctors: 300,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-004", "capability", "0.76", "high", "Oncology, neurosciences, orthopedics, gastroenterology, nephrology — broad multi-specialty scope with named departments.", "capability", false, null),
      sig("fac-004", "equipment", "0.44", "medium", "CT scanner, X-ray, ultrasound, mammography listed in structured field. Description references MRI but it is absent from the equipment field.", "equipment", true, "Description text claims MRI availability; the equipment structured field does not list MRI. Rely on the structured field until verified."),
      sig("fac-004", "procedure", "0.68", "medium", "Chemotherapy, spine surgery, joint replacement, dialysis — procedures plausibly match stated capability, but MRI-dependent procedures lack equipment support.", "procedure", false, null),
      sig("fac-004", "completeness", null, "insufficient_data", "year_established coverage in dataset is 48%; score suppressed to avoid false precision.", "year_established", false, null),
    ],
  },
  "fac-005": {
    facility: {
      facility_id: "fac-005",
      facility_name: "ESI Hospital, Thane",
      facility_type: "Hospital",
      state: "Maharashtra",
      district: "Thane",
      description: "Employee State Insurance Corporation hospital. General and occupational medicine, surgery, and maternity services for insured workers.",
      capability: "General medicine, occupational medicine, surgery, maternity",
      procedure: "Minor surgeries, normal deliveries, occupational injury management",
      equipment: "X-ray, ECG, basic lab, ultrasound",
      capacity: 150,
      year_established: 1978,
      official_phone: "+91 22 2545 0000",
      email: null,
      official_website: null,
      address_line1: "MIDC Area, Thane, Maharashtra 400604",
      number_doctors: 60,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-005", "capability", "0.49", "medium", "General medicine, occupational medicine, surgery, maternity — ESI mandate scope; no specialty units declared.", "capability", false, null),
      sig("fac-005", "equipment", "0.42", "medium", "X-ray, ECG, basic lab, ultrasound — minimal imaging, appropriate for the stated scope but not comprehensive.", "equipment", false, null),
      sig("fac-005", "procedure", "0.46", "medium", "Minor surgeries, normal deliveries, occupational injury management — consistent with ESI primary and secondary care mandate.", "procedure", false, null),
      sig("fac-005", "completeness", null, "insufficient_data", "year_established coverage insufficient; capacity (150) recorded. Completeness score suppressed.", "capacity", false, null),
    ],
  },
  "fac-006": {
    facility: {
      facility_id: "fac-006",
      facility_name: "AIIMS Jodhpur",
      facility_type: "Hospital",
      state: "Rajasthan",
      district: "Jodhpur",
      description: "Premier autonomous government medical institute under MoHFW. Tertiary and quaternary care across all major specialties. Teaching and research hospital.",
      capability: "All major specialties including trauma, oncology, neurology, cardiology, transplant",
      procedure: "Organ transplant, complex trauma surgery, cancer resection, cardiac catheterization",
      equipment: "3T MRI, 64-slice CT, linear accelerator, robotic surgery, PET-CT",
      capacity: 500,
      year_established: 2012,
      official_phone: "+91 291 280 1400",
      email: "aiims@aiims.edu",
      official_website: null,
      address_line1: "Basni Phase 2, Jodhpur, Rajasthan 342005",
      number_doctors: 180,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-006", "capability", "0.93", "high", "All major specialties including trauma, oncology, neurology, cardiology, transplant — comprehensive AIIMS mandate confirmed.", "capability", false, null),
      sig("fac-006", "equipment", "0.91", "high", "3T MRI, 64-slice CT, linear accelerator, robotic surgery, PET-CT — equipment consistent with quaternary institute.", "equipment", false, null),
      sig("fac-006", "procedure", "0.89", "high", "Organ transplant, complex trauma surgery, cancer resection, cardiac catheterization — all procedures have equipment and specialist support.", "procedure", false, null),
      sig("fac-006", "completeness", null, "insufficient_data", "year_established (2012) present but dataset coverage for this field is 48%; score suppressed per pipeline rules.", "year_established", false, null),
    ],
  },
  "fac-007": {
    facility: {
      facility_id: "fac-007",
      facility_name: "Narayana Health City, Bengaluru",
      facility_type: "Hospital",
      state: "Karnataka",
      district: "Bengaluru Urban",
      description: "High-volume quaternary care facility known for cardiac surgery and transplants. Free-text mentions 'level-1 trauma' but no trauma listed in capability structured field.",
      capability: "Cardiac surgery, bone marrow transplant, nephrology, paediatric cardiology",
      procedure: "Heart transplant, bone marrow transplant, dialysis, paediatric cardiac repair",
      equipment: "Heart-lung bypass machine, ECMO, 256-slice CT, cath lab",
      capacity: 1000,
      year_established: 2000,
      official_phone: "+91 80 7122 2222",
      email: "info@narayanahealth.org",
      official_website: null,
      address_line1: "Bommasandra, Bengaluru 560099",
      number_doctors: 400,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-007", "capability", "0.71", "high", "Cardiac surgery, bone marrow transplant, nephrology, paediatric cardiology — high-specificity specialties with coherent cluster.", "capability", true, "Description text references 'level-1 trauma centre' but trauma is absent from the capability structured field. Do not assume trauma readiness."),
      sig("fac-007", "equipment", "0.84", "high", "Heart-lung bypass machine, ECMO, 256-slice CT, cath lab — all equipment directly supports stated cardiac and transplant procedures.", "equipment", false, null),
      sig("fac-007", "procedure", "0.80", "high", "Heart transplant, bone marrow transplant, dialysis, paediatric cardiac repair — all match capability and equipment data.", "procedure", false, null),
      sig("fac-007", "completeness", null, "insufficient_data", "capacity (1000 beds) present; year_established dataset coverage is 48%; completeness score suppressed.", "capacity", false, null),
    ],
  },
  "fac-008": {
    facility: {
      facility_id: "fac-008",
      facility_name: "Primary Health Centre, Nanded",
      facility_type: "PHC",
      state: "Maharashtra",
      district: "Nanded",
      description: "Rural primary health centre providing basic preventive and curative care. OPD, maternal health, immunisation, and minor wound care.",
      capability: "OPD, maternal health, immunisation, wound care",
      procedure: "Antenatal care, immunisation, wound dressing, ORS administration",
      equipment: "Basic diagnostic kit, weighing scale, BP cuff",
      capacity: 6,
      year_established: 2001,
      official_phone: "+91 2462 222 111",
      email: null,
      official_website: null,
      address_line1: "Village Road, Nanded, Maharashtra 431601",
      number_doctors: 2,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-008", "capability", "0.31", "low", "OPD, maternal health, immunisation, wound care — PHC-appropriate scope but very limited; no laboratory or imaging listed.", "capability", false, null),
      sig("fac-008", "equipment", "0.22", "low", "Basic diagnostic kit, weighing scale, BP cuff — minimal equipment; no imaging or laboratory equipment present.", "equipment", false, null),
      sig("fac-008", "procedure", "0.28", "low", "Antenatal care, immunisation, wound dressing, ORS administration — standard PHC procedures with no surgical capability.", "procedure", false, null),
      sig("fac-008", "completeness", null, "insufficient_data", "capacity (6 beds) recorded; year_established coverage insufficient for completeness scoring.", "capacity", false, null),
    ],
  },
  "fac-009": {
    facility: {
      facility_id: "fac-009",
      facility_name: "Kokilaben Dhirubhai Ambani Hospital",
      facility_type: "Hospital",
      state: "Maharashtra",
      district: "Mumbai",
      description: "Quaternary care hospital with advanced robotics and cyber-knife radiosurgery. ISO and NABH accredited.",
      capability: "Robotic surgery, radiosurgery, oncology, neurology, cardiology, urology",
      procedure: "Robotic prostatectomy, cyber-knife treatment, TAVI, craniotomy",
      equipment: "Da Vinci robotic system, Cyber-knife, 3T MRI, biplane cath lab",
      capacity: 750,
      year_established: 2009,
      official_phone: "+91 22 3066 1000",
      email: "info@kokilabenhospital.com",
      official_website: null,
      address_line1: "Four Bungalows, Andheri West, Mumbai 400053",
      number_doctors: 350,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-009", "capability", "0.90", "high", "Robotic surgery, radiosurgery, oncology, neurology, cardiology, urology — coherent quaternary profile with high-specificity terms.", "capability", false, null),
      sig("fac-009", "equipment", "0.93", "high", "Da Vinci robotic system, Cyber-knife, 3T MRI, biplane cath lab — equipment is specific and consistent with stated procedures.", "equipment", false, null),
      sig("fac-009", "procedure", "0.88", "high", "Robotic prostatectomy, cyber-knife treatment, TAVI, craniotomy — all procedures have direct equipment and specialty support.", "procedure", false, null),
      sig("fac-009", "completeness", null, "insufficient_data", "year_established dataset coverage is 48%; score suppressed. capacity (750) recorded.", "year_established", false, null),
    ],
  },
  "fac-010": {
    facility: {
      facility_id: "fac-010",
      facility_name: "Community Health Centre, Silchar",
      facility_type: "CHC",
      state: "Assam",
      district: "Cachar",
      description: "Community health centre providing secondary care referral services. General surgery, obstetrics, and paediatrics.",
      capability: "General surgery, obstetrics, paediatrics, internal medicine",
      procedure: "C-section, hernia repair, neonatal care",
      equipment: "X-ray, ultrasound, operation theatre",
      capacity: 30,
      year_established: 1997,
      official_phone: "+91 3842 230 000",
      email: null,
      official_website: null,
      address_line1: "Ghungoor, Silchar, Assam 788115",
      number_doctors: 12,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-010", "capability", "0.44", "medium", "General surgery, obstetrics, paediatrics, internal medicine — appropriate CHC scope; no specialty units declared.", "capability", false, null),
      sig("fac-010", "equipment", "0.40", "medium", "X-ray, ultrasound, operation theatre — sufficient for stated procedures; no advanced imaging.", "equipment", false, null),
      sig("fac-010", "procedure", "0.43", "medium", "C-section, hernia repair, neonatal care — procedures match capability and equipment.", "procedure", false, null),
      sig("fac-010", "completeness", null, "insufficient_data", "year_established dataset coverage is 48%; completeness score suppressed.", "year_established", false, null),
    ],
  },
  "fac-011": {
    facility: {
      facility_id: "fac-011",
      facility_name: "Max Super Speciality Hospital, Saket",
      facility_type: "Hospital",
      state: "Delhi",
      district: "South Delhi",
      description: "NABH-accredited quaternary care hospital. Known for liver transplants and minimal access surgery. Structured capacity field is blank; description mentions 500 beds.",
      capability: "Liver transplant, minimal access surgery, oncology, neurosurgery, cardiology",
      procedure: "Liver transplant, laparoscopic surgery, gamma knife radiosurgery",
      equipment: "Gamma knife, 3T MRI, 64-slice CT, robotic surgery, endoscopy suite",
      capacity: null,
      year_established: 2006,
      official_phone: "+91 11 2651 5050",
      email: "info@maxhealthcare.in",
      official_website: null,
      address_line1: "Press Enclave Road, Saket, New Delhi 110017",
      number_doctors: 220,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-011", "capability", "0.86", "high", "Liver transplant, minimal access surgery, oncology, neurosurgery, cardiology — strong quaternary profile.", "capability", false, null),
      sig("fac-011", "equipment", "0.87", "high", "Gamma knife, 3T MRI, 64-slice CT, robotic surgery, endoscopy suite — all equipment supports stated procedures.", "equipment", false, null),
      sig("fac-011", "procedure", "0.83", "high", "Liver transplant, laparoscopic surgery, gamma knife radiosurgery — procedures have direct equipment and specialty confirmation.", "procedure", false, null),
      sig("fac-011", "completeness", "0.35", "low", "Structured capacity field is null; description mentions '500 beds'. Cannot verify bed count from structured data alone.", "capacity", true, "Structured capacity field is empty (null). Description claims 500 beds. Do not rely on capacity figure without independent verification."),
    ],
  },
  "fac-012": {
    facility: {
      facility_id: "fac-012",
      facility_name: "NIMHANS, Bengaluru",
      facility_type: "Hospital",
      state: "Karnataka",
      district: "Bengaluru Urban",
      description: "National Institute of Mental Health and Neuro Sciences. Premier autonomous institute for psychiatry and neurosciences research and care.",
      capability: "Psychiatry, clinical psychology, neurology, neurosurgery, de-addiction",
      procedure: "ECT, deep brain stimulation, epilepsy surgery, psychotherapy",
      equipment: "3T MRI, EEG, EMG, TMS unit, neuropsychology lab",
      capacity: 750,
      year_established: 1925,
      official_phone: "+91 80 4600 3000",
      email: "nimhans@nimhans.ac.in",
      official_website: null,
      address_line1: "Hosur Road, Bengaluru 560029",
      number_doctors: 280,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-012", "capability", "0.94", "high", "Psychiatry, clinical psychology, neurology, neurosurgery, de-addiction — coherent specialist neuroscience cluster; NIMHANS mandate confirmed.", "capability", false, null),
      sig("fac-012", "equipment", "0.89", "high", "3T MRI, EEG, EMG, TMS unit, neuropsychology lab — all equipment specific to neurosciences; internally consistent.", "equipment", false, null),
      sig("fac-012", "procedure", "0.91", "high", "ECT, deep brain stimulation, epilepsy surgery, psychotherapy — procedures match equipment and specialty profile precisely.", "procedure", false, null),
      sig("fac-012", "completeness", null, "insufficient_data", "year_established dataset coverage is 48%; completeness score suppressed despite year_established (1925) being present.", "year_established", false, null),
    ],
  },
  "fac-013": {
    facility: {
      facility_id: "fac-013",
      facility_name: "Sankara Nethralaya, Chennai",
      facility_type: "Hospital",
      state: "Tamil Nadu",
      district: "Chennai",
      description: "Superspecialty eye hospital and research institute. Largest dedicated ophthalmology centre in Asia. All procedures are ophthalmic.",
      capability: "Ophthalmology: cornea, glaucoma, retina, oculoplasty, paediatric ophthalmology",
      procedure: "LASIK, cataract surgery, vitreoretinal surgery, corneal transplant",
      equipment: "OCT scanner, fundus camera, femtosecond laser, phacoemulsification units",
      capacity: 500,
      year_established: 1978,
      official_phone: "+91 44 2827 1616",
      email: "snec@vsnl.com",
      official_website: null,
      address_line1: "18 College Road, Chennai 600006",
      number_doctors: 150,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-013", "capability", "0.92", "high", "Cornea, glaucoma, retina, oculoplasty, paediatric ophthalmology — comprehensive ophthalmic subspecialty coverage.", "capability", false, null),
      sig("fac-013", "equipment", "0.90", "high", "OCT scanner, fundus camera, femtosecond laser, phacoemulsification units — all equipment is ophthalmic-specific and consistent.", "equipment", false, null),
      sig("fac-013", "procedure", "0.88", "high", "LASIK, cataract surgery, vitreoretinal surgery, corneal transplant — all procedures have direct equipment support.", "procedure", false, null),
      sig("fac-013", "completeness", null, "insufficient_data", "year_established dataset coverage insufficient; completeness score suppressed.", "year_established", false, null),
    ],
  },
  "fac-014": {
    facility: {
      facility_id: "fac-014",
      facility_name: "Medanta — The Medicity",
      facility_type: "Hospital",
      state: "Haryana",
      district: "Gurugram",
      description: "1,250-bed quaternary hospital. Claims 'largest heart institute in India' in description but cardiac beds listed as 75 in structured field.",
      capability: "Cardiology, cardiac surgery, neurosciences, bone marrow transplant, robotics",
      procedure: "TAVI, LVAD implantation, DBS, bone marrow transplant, robotic surgery",
      equipment: "Biplane cath lab, LVAD devices, 3T MRI, PET-CT, robotic surgery system",
      capacity: 1250,
      year_established: 2009,
      official_phone: "+91 124 4141 414",
      email: "care@medanta.org",
      official_website: null,
      address_line1: "CH Baktawar Singh Road, Sector 38, Gurugram 122001",
      number_doctors: 500,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-014", "capability", "0.88", "high", "Cardiology, cardiac surgery, neurosciences, bone marrow transplant, robotics — consistent quaternary profile.", "capability", false, null),
      sig("fac-014", "equipment", "0.86", "high", "Biplane cath lab, LVAD devices, 3T MRI, PET-CT, robotic surgery system — equipment list fully supports stated procedures.", "equipment", false, null),
      sig("fac-014", "procedure", "0.82", "high", "TAVI, LVAD implantation, DBS, bone marrow transplant — all high-complexity procedures with equipment confirmation.", "procedure", true, "Description claims 'largest heart institute in India'; structured cardiac bed count is 75 out of 1,250 total. The superlative claim cannot be verified from structured data alone."),
      sig("fac-014", "completeness", null, "insufficient_data", "year_established dataset coverage is 48%; completeness score suppressed.", "year_established", false, null),
    ],
  },
  "fac-015": {
    facility: {
      facility_id: "fac-015",
      facility_name: "Christian Medical College, Vellore",
      facility_type: "Hospital",
      state: "Tamil Nadu",
      district: "Vellore",
      description: "Quaternary academic medical centre and deemed university. Comprehensive multi-specialty tertiary care with strong research and teaching mandate.",
      capability: "All specialties: transplant, oncology, haematology, rheumatology, neurology, cardiology",
      procedure: "Bone marrow transplant, liver transplant, stereotactic radiosurgery, cardiac surgery",
      equipment: "Gamma knife, 3T MRI, PET-CT, linear accelerator, ECMO, cath lab",
      capacity: 2500,
      year_established: 1900,
      official_phone: "+91 416 228 2010",
      email: "info@cmcvellore.ac.in",
      official_website: null,
      address_line1: "Ida Scudder Road, Vellore, Tamil Nadu 632004",
      number_doctors: 900,
      overridden_fields: [],
    },
    trust_signals: [
      sig("fac-015", "capability", "0.96", "high", "All specialties including transplant, oncology, haematology, rheumatology, neurology, cardiology — comprehensive academic centre profile.", "capability", false, null),
      sig("fac-015", "equipment", "0.94", "high", "Gamma knife, 3T MRI, PET-CT, linear accelerator, ECMO, cath lab — all equipment is specific and internally consistent.", "equipment", false, null),
      sig("fac-015", "procedure", "0.92", "high", "Bone marrow transplant, liver transplant, stereotactic radiosurgery, cardiac surgery — every procedure has direct equipment and capability support.", "procedure", false, null),
      sig("fac-015", "completeness", null, "insufficient_data", "year_established dataset coverage is 48%; completeness score suppressed.", "year_established", false, null),
    ],
  },
};

function avgScore(signals: TrustSignal[]): string | null {
  const valid = signals
    .filter((s) => s.confidence_tier !== "insufficient_data" && s.trust_score !== null)
    .map((s) => parseFloat(s.trust_score!));
  if (valid.length === 0) return null;
  return String(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export const DUMMY_LIST: FacilityListItem[] = Object.values(DUMMY_DETAILS).map((d) => ({
  facility_id: d.facility.facility_id,
  facility_name: d.facility.facility_name,
  state: d.facility.state,
  facility_type: d.facility.facility_type,
  overall_trust_score: avgScore(d.trust_signals),
  has_contradiction: d.trust_signals.some((s) => s.contradiction) ? 1 : 0,
  signal_count: d.trust_signals.length,
}));

export const DUMMY_META = {
  states: [...new Set(DUMMY_LIST.map((f) => f.state).filter(Boolean) as string[])].sort(),
  facility_types: [...new Set(DUMMY_LIST.map((f) => f.facility_type).filter(Boolean) as string[])].sort(),
};

export function filterDummyList(
  q: string,
  state: string,
  facilityType: string,
  contradictionsOnly: boolean,
  page: number,
  limit: number,
): FacilityListItem[] {
  const lower = q.toLowerCase();
  return DUMMY_LIST.filter((f) => {
    if (q && !f.facility_name.toLowerCase().includes(lower) &&
        !(f.state ?? "").toLowerCase().includes(lower) &&
        !(f.facility_type ?? "").toLowerCase().includes(lower)) return false;
    if (state && f.state !== state) return false;
    if (facilityType && f.facility_type !== facilityType) return false;
    if (contradictionsOnly && f.has_contradiction !== 1) return false;
    return true;
  }).slice((page - 1) * limit, page * limit);
}

const LS_KEY = (facilityId: string, analystId: string) =>
  `fiq_actions_${facilityId}_${analystId}`;

export function allActedFacilityIds(analystId: string): string[] {
  const prefix = "fiq_actions_";
  const suffix = `_${analystId}`;
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && key.endsWith(suffix)) {
      const id = key.slice(prefix.length, key.length - suffix.length);
      if (id) ids.push(id);
    }
  }
  return ids;
}

export function loadLocalActions(facilityId: string, analystId: string): UserAction[] {
  try {
    const raw = localStorage.getItem(LS_KEY(facilityId, analystId));
    return raw ? (JSON.parse(raw) as UserAction[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalAction(
  facilityId: string,
  analystId: string,
  action_type: UserAction["action_type"],
  content: string | null,
  dimension: string | null,
  override_score: number | null,
): UserAction {
  const existing = loadLocalActions(facilityId, analystId);
  const newAction: UserAction = {
    action_id: crypto.randomUUID(),
    facility_id: facilityId,
    analyst_id: analystId,
    action_type,
    dimension,
    content,
    override_score,
    updated_at: new Date().toISOString(),
  };
  existing.push(newAction);
  try {
    localStorage.setItem(LS_KEY(facilityId, analystId), JSON.stringify(existing));
  } catch {}
  return newAction;
}

export function latestLocalActions(facilityId: string, analystId: string): UserAction[] {
  const all = loadLocalActions(facilityId, analystId);
  const map = new Map<string, UserAction>();
  for (const a of all) {
    const key = `${a.action_type}__${a.dimension ?? ""}`;
    const existing = map.get(key);
    if (!existing || a.updated_at > existing.updated_at) map.set(key, a);
  }
  return [...map.values()];
}

// ── Kanban board localStorage fallback ────────────────────────────────────────

const KANBAN_LS_KEY = "fiq_kanban";

interface LocalReviewEntry {
  status: string;
  parked_reason: string | null;
  notes: string | null;
  updated_at: string;
}

// Pre-seeded demo state so the board has cards in every column from the start.
// fac-007 (Narayana Health City) stays in not_started for the guided tour flow.
const DEMO_KANBAN_SEED: Record<string, LocalReviewEntry> = {
  "fac-001": { status: "in_progress",         parked_reason: null, notes: "High-trust hospital — checking equipment claims against recent reports.", updated_at: "2026-06-15T09:14:00Z" },
  "fac-002": { status: "in_progress",         parked_reason: null, notes: null, updated_at: "2026-06-15T11:02:00Z" },
  "fac-003": { status: "email_sent",          parked_reason: null, notes: "Bed count contradiction flagged — asked facility for clarification.", updated_at: "2026-06-15T13:30:00Z" },
  "fac-004": { status: "email_sent",          parked_reason: null, notes: null, updated_at: "2026-06-15T14:05:00Z" },
  "fac-005": { status: "parked",              parked_reason: "No valid contact info — phone and email both invalid.", notes: null, updated_at: "2026-06-14T16:20:00Z" },
  "fac-006": { status: "called",              parked_reason: null, notes: "Spoke with admin — confirmed AIIMS status. Awaiting written verification.", updated_at: "2026-06-15T10:45:00Z" },
  "fac-009": { status: "called",              parked_reason: null, notes: null, updated_at: "2026-06-15T15:00:00Z" },
  "fac-011": { status: "validation_complete", parked_reason: null, notes: "All four dimensions verified against public records.", updated_at: "2026-06-14T17:00:00Z" },
  "fac-012": { status: "validation_complete", parked_reason: null, notes: null, updated_at: "2026-06-14T17:30:00Z" },
  "fac-013": { status: "validation_complete", parked_reason: null, notes: "Ophthalmology claims fully corroborated.", updated_at: "2026-06-14T18:00:00Z" },
};

function getLocalKanbanBoard(): Record<string, LocalReviewEntry> {
  try {
    const raw = localStorage.getItem(KANBAN_LS_KEY);
    // Merge seed with any user-made changes so the demo board is never empty
    const userBoard = raw ? (JSON.parse(raw) as Record<string, LocalReviewEntry>) : {};
    return { ...DEMO_KANBAN_SEED, ...userBoard };
  } catch {
    return { ...DEMO_KANBAN_SEED };
  }
}

export function setLocalKanbanStatus(
  facilityId: string,
  status: string,
  parked_reason: string | null = null,
  notes: string | null = null,
): void {
  const board = getLocalKanbanBoard();
  board[facilityId] = { status, parked_reason, notes, updated_at: new Date().toISOString() };
  try {
    localStorage.setItem(KANBAN_LS_KEY, JSON.stringify(board));
  } catch {}
}

export function getLocalBoardColumn(status: string): ReviewCard[] {
  const board = getLocalKanbanBoard();
  return Object.entries(board)
    .filter(([, v]) => v.status === status)
    .map(([id, v]) => {
      const f = DUMMY_LIST.find((f) => f.facility_id === id);
      return {
        facility_id: id,
        facility_name: f?.facility_name ?? id,
        facility_type: f?.facility_type ?? null,
        state: f?.state ?? null,
        status: v.status as ReviewStatus,
        parked_reason: v.parked_reason,
        assigned_to: null,
        notes: v.notes,
        updated_by: null,
        updated_at: v.updated_at,
      };
    });
}

export function getLocalUnstartedFacilities(): ReviewCard[] {
  const board = getLocalKanbanBoard();
  const inBoard = new Set(Object.keys(board));
  return DUMMY_LIST.filter((f) => !inBoard.has(f.facility_id))
    .slice(0, 50)
    .map((f) => ({
      facility_id: f.facility_id,
      facility_name: f.facility_name,
      facility_type: f.facility_type,
      state: f.state,
      status: "not_started" as ReviewStatus,
      parked_reason: null,
      assigned_to: null,
      notes: null,
      updated_by: null,
      updated_at: new Date().toISOString(),
    }));
}

export function getLocalReviewEntry(
  facilityId: string,
): { status: string; parked_reason: string | null } | null {
  try {
    const raw = localStorage.getItem("fiq_kanban");
    const board = raw ? (JSON.parse(raw) as Record<string, { status: string; parked_reason: string | null }>) : {};
    const entry = board[facilityId];
    return entry ? { status: entry.status, parked_reason: entry.parked_reason ?? null } : null;
  } catch {
    return null;
  }
}
