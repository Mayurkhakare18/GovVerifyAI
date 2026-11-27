-- ==============================================================================
-- GOVVERIFY AI — PHASE 5 SCHEMES & DISCOVERY ENGINE SCHEMA MIGRATION
-- Migration: 20261013000000_phase5_schemes_schema.sql
-- Description: Core schemes table, full-text search indexes, non-recursive RLS,
--              and verified sovereign scheme catalogue.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_name TEXT NOT NULL,
  short_name TEXT,
  slug TEXT UNIQUE NOT NULL,
  administering_ministry TEXT NOT NULL,
  department TEXT,
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('CENTRAL', 'STATE', 'JOINT')),
  state TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  benefits TEXT NOT NULL,
  eligibility_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  application_procedure JSONB NOT NULL DEFAULT '{}'::jsonb,
  official_url TEXT NOT NULL,
  source_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UPCOMING', 'CLOSED', 'DISCONTINUED', 'RENAMED', 'UNKNOWN')),
  last_verified_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance, full-text matching, and filtering
CREATE INDEX IF NOT EXISTS idx_schemes_jurisdiction ON public.schemes(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schemes_category ON public.schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_status ON public.schemes(status);
CREATE INDEX IF NOT EXISTS idx_schemes_name ON public.schemes(scheme_name);

-- Row-Level Security:
-- Publicly readable by all citizens; writes restricted to backend service role
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.schemes TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.schemes FROM anon, authenticated;

DROP POLICY IF EXISTS "Public schemes are viewable by all users" ON public.schemes;
CREATE POLICY "Public schemes are viewable by all users"
  ON public.schemes FOR SELECT
  USING (true);

-- Seed Initial Verified Sovereign Scheme Catalogue (Central & Maharashtra)
INSERT INTO public.schemes (
  scheme_name,
  short_name,
  slug,
  administering_ministry,
  department,
  jurisdiction,
  state,
  category,
  description,
  benefits,
  eligibility_conditions,
  required_documents,
  application_procedure,
  official_url,
  source_citations,
  status,
  last_verified_date
) VALUES
(
  'Pradhan Mantri Kisan Samman Nidhi',
  'PM-KISAN',
  'pm-kisan',
  'Ministry of Agriculture and Farmers Welfare',
  'Department of Agriculture & Farmers Welfare',
  'CENTRAL',
  NULL,
  'Agriculture',
  'Direct income support scheme providing financial assistance to all landholding farmer families across India for procuring agricultural inputs and domestic needs.',
  'Rs 6,000 per year transferred directly to bank accounts in three equal 4-monthly installments of Rs 2,000 each.',
  '["All landholding farmer families with cultivable land in their names", "Subject to exclusion criteria: institutional landholders, tax-paying individuals, and high-income professionals"]'::jsonb,
  '["Aadhaar Card", "Land ownership documentation (Khatauni / Patta / 7-12 extract)", "Active bank account linked with Aadhaar / NPCI mapping", "Valid mobile number"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Visit official portal pmkisan.gov.in", "Navigate to Farmers Corner and select New Farmer Registration", "Authenticate via Aadhaar and OTP", "Enter land details, survey number, and bank account", "Submit for state revenue authority verification"], "officialPortalUrl": "https://pmkisan.gov.in"}'::jsonb,
  'https://pmkisan.gov.in',
  '[{"title": "PM-KISAN Operational Guidelines", "url": "https://pmkisan.gov.in/guidelines", "domain": "pmkisan.gov.in", "issuingAuthority": "Ministry of Agriculture and Farmers Welfare"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan (Component B)',
  'PM-KUSUM',
  'pm-kusum',
  'Ministry of New and Renewable Energy',
  'Solar Energy Division',
  'CENTRAL',
  NULL,
  'Agriculture',
  'Government initiative aimed at providing clean energy to farmers by supporting the installation of standalone solar-powered agriculture pumps in off-grid areas.',
  'Central Financial Assistance (CFA) of 30% of benchmark cost, state government subsidy of 30%, and remaining 40% financed through farmer contribution / bank loan.',
  '["Individual farmers, water user associations, and farmer producer organizations", "Possession of cultivable agricultural land", "Valid grid connection status: targeted at areas without grid electricity or replacing diesel pumps"]'::jsonb,
  '["Aadhaar Card", "Land ownership / lease records", "Bank account details", "Passport size photograph"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Apply via state designated nodal agency portal or central PM-KUSUM portal", "Select solar pump capacity and type", "Submit proof of land and identity", "Deposit farmer share after preliminary survey approval", "Installation and commissioning by empaneled vendors"], "officialPortalUrl": "https://pmkusum.mnre.gov.in"}'::jsonb,
  'https://pmkusum.mnre.gov.in',
  '[{"title": "PM-KUSUM Scheme Guidelines", "url": "https://pmkusum.mnre.gov.in", "domain": "mnre.gov.in", "issuingAuthority": "Ministry of New and Renewable Energy"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'National Scholarship Portal Central Sector Scheme of Scholarship for College and University Students',
  'CSSS',
  'nsp-central-sector-scholarship',
  'Ministry of Education',
  'Department of Higher Education',
  'CENTRAL',
  NULL,
  'Scholarships & Education',
  'Financial support to meritorious students from low-income families to meet day-to-day expenses while pursuing higher education in colleges and universities.',
  'Rs 12,000 per annum at graduation level for the first three years and Rs 20,000 per annum at post-graduation level directly disbursed via DBT.',
  '["Above 80th percentile of successful candidates in Class 12 board examination", "Pursuing regular full-time degree courses in recognized institutions", "Gross family annual income not exceeding Rs 4.5 Lakh", "Not availing any other government scholarship"]'::jsonb,
  '["Class 12 marksheet", "Income certificate from competent revenue authority", "Aadhaar Card", "Bonafide student certificate from college/university", "Bank passbook"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Register on National Scholarship Portal scholarships.gov.in", "Select Central Sector Scheme of Scholarship", "Upload academic and income documents", "Application verified by Institute Nodal Officer (INO)", "State Nodal Officer verification and DBT disbursement via PFMS"], "officialPortalUrl": "https://scholarships.gov.in"}'::jsonb,
  'https://scholarships.gov.in',
  '[{"title": "Central Sector Scholarship Guidelines", "url": "https://scholarships.gov.in", "domain": "scholarships.gov.in", "issuingAuthority": "Department of Higher Education, Ministry of Education"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana',
  'AB-PMJAY',
  'ayushman-bharat-pmjay',
  'Ministry of Health and Family Welfare',
  'National Health Authority',
  'CENTRAL',
  NULL,
  'Healthcare',
  'World’s largest government-funded health assurance program providing cashless hospitalization coverage for secondary and tertiary healthcare to vulnerable families.',
  'Health coverage of up to Rs 5 Lakh per family per year on a family floater basis across thousands of public and empaneled private hospitals nationwide.',
  '["Identified as eligible under Socio-Economic Caste Census (SECC 2011) deprivation criteria", "Active NFSA / Antyodaya ration card holders", "Senior citizens aged 70 and above regardless of family income (extended coverage)"]'::jsonb,
  '["Aadhaar Card", "Ration Card", "Active mobile number for OTP verification"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Check eligibility on beneficiary.nha.gov.in or nearest Ayushman Mitra kiosk", "Complete e-KYC using Aadhaar biometric/OTP", "Download official Ayushman Card (Golden Card)", "Present at any empaneled hospital for cashless treatment"], "officialPortalUrl": "https://beneficiary.nha.gov.in"}'::jsonb,
  'https://beneficiary.nha.gov.in',
  '[{"title": "National Health Authority PM-JAY Guidelines", "url": "https://nha.gov.in", "domain": "nha.gov.in", "issuingAuthority": "National Health Authority"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Pradhan Mantri Street Vendor AtmaNirbhar Nidhi',
  'PM SVANidhi',
  'pm-svanidhi',
  'Ministry of Housing and Urban Affairs',
  'Urban Livelihoods Division',
  'CENTRAL',
  NULL,
  'Small Business & MSME',
  'Micro-credit scheme providing working capital loans to urban and peri-urban street vendors to resume and expand their livelihoods with interest subsidies.',
  'Initial collateral-free working capital loan up to Rs 10,000, 2nd tranche up to Rs 20,000, and 3rd tranche up to Rs 50,000 with 7% interest subsidy on timely repayment and digital cashback incentives.',
  '["Street vendors engaged in vending in urban areas on or before March 24, 2020", "Vendors possessing Certificate of Vending or Letter of Recommendation (LoR) from Urban Local Body (ULB)"]'::jsonb,
  '["Aadhaar Card", "Certificate of Vending (CoV) / Identity Card issued by ULB", "Bank account passbook", "Registered mobile number"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Access official portal pmsvanidhi.mohua.gov.in or visit common service center (CSC)", "Check vendor verification status", "Submit loan application selecting preferred lending institution", "Loan disbursed directly to bank account upon sanction"], "officialPortalUrl": "https://pmsvanidhi.mohua.gov.in"}'::jsonb,
  'https://pmsvanidhi.mohua.gov.in',
  '[{"title": "PM SVANidhi Guidelines", "url": "https://pmsvanidhi.mohua.gov.in", "domain": "mohua.gov.in", "issuingAuthority": "Ministry of Housing and Urban Affairs"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti Yojna',
  'MahaDBT Shahu Maharaj Scholarship',
  'mahadbt-shahu-maharaj-scholarship',
  'Government of Maharashtra',
  'Directorate of Higher Education / MahaDBT',
  'STATE',
  'Maharashtra',
  'Scholarships & Education',
  'State scholarship program reimbursing 50% tuition and exam fees for economically backward class (EBC) students pursuing professional and non-professional higher education in Maharashtra.',
  '50% reimbursement of tuition fees and exam fees in government, government-aided, and non-aided recognized educational colleges.',
  '["Domicile of Maharashtra state", "Enrolled in approved higher education / professional degree courses through CAP rounds", "Family annual income from all sources not exceeding Rs 8.00 Lakh", "Minimum 50% attendance in previous semester"]'::jsonb,
  '["Maharashtra Domicile Certificate", "Income Certificate issued by Tahsildar for current financial year", "HSC / Degree marksheets", "Fee receipt and College Bonafide certificate", "Aadhaar Card linked to bank account", "Ration card"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Register on MahaDBT portal mahadbt.maharashtra.gov.in", "Create citizen login and complete Aadhaar authentication", "Select Directorate of Higher Education -> Rajarshi Shahu Maharaj Scheme", "Enter college, course, and caste/EBC category details", "Upload verified certificates and submit before session deadline"], "officialPortalUrl": "https://mahadbt.maharashtra.gov.in"}'::jsonb,
  'https://mahadbt.maharashtra.gov.in',
  '[{"title": "MahaDBT DHE Scheme Rules", "url": "https://mahadbt.maharashtra.gov.in", "domain": "maharashtra.gov.in", "issuingAuthority": "Government of Maharashtra"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Mahatma Jyotirao Phule Shetkari Karjmukti Yojana',
  'MJPSKY',
  'mahatma-jyotirao-phule-karjmukti',
  'Government of Maharashtra',
  'Co-operation, Marketing and Textiles Department',
  'STATE',
  'Maharashtra',
  'Agriculture',
  'Debt relief program providing farm loan waivers to distressed farmers across Maharashtra for outstanding crop loans.',
  'Loan waiver of up to Rs 2.00 Lakh for overdue short-term crop loans, alongside incentive grants of up to Rs 50,000 for farmers who regularly repaid their loans.',
  '["Individual farmers with crop loan accounts in cooperative, regional rural, or commercial banks in Maharashtra", "Excludes ministers, MLAs/MLCs, government employees (excluding Class IV), and income tax payees"]'::jsonb,
  '["Aadhaar Card", "Loan account passbook", "Land 7/12 extract", "Bank Aadhaar authentication acknowledgement"]'::jsonb,
  '{"mode": "HYBRID", "steps": ["Bank compiles list of overdue crop loan accounts", "List displayed at Gram Panchayat and bank branches", "Farmer visits nearest CSC with Aadhaar for biometric authentication", "Upon verification, waiver amount credited directly to loan account"], "officialPortalUrl": "https://mjpsky.maharashtra.gov.in"}'::jsonb,
  'https://mjpsky.maharashtra.gov.in',
  '[{"title": "MJPSKY Government Resolution", "url": "https://mjpsky.maharashtra.gov.in", "domain": "maharashtra.gov.in", "issuingAuthority": "Government of Maharashtra"}]'::jsonb,
  'ACTIVE',
  NOW()
),
(
  'Mukhyamantri Saur Krushi Pump Yojana (Magel Tyala Saur Krushi Pump)',
  'Maharashtra Solar Pump Yojana',
  'maharashtra-saur-krushi-pump',
  'Government of Maharashtra',
  'Energy Department / MSEDCL (Mahavitaran)',
  'STATE',
  'Maharashtra',
  'Agriculture',
  'State-sponsored deployment of subsidized off-grid solar agricultural pumps to farmers to ensure daytime irrigation and eliminate reliance on conventional electricity grid lines.',
  '90% to 95% subsidy on solar pump installation: general category farmers contribute only 10% of total cost; SC/ST category farmers contribute only 5%.',
  '["Farmers with agricultural land holding having an assured water source (well, borewell, farm pond)", "Traditional electricity connection not available / remote non-electrified areas", "Landholding criteria: up to 5 acres eligible for 3 HP or 5 HP; above 5 acres eligible for 7.5 HP"]'::jsonb,
  '["7/12 and 8-A land extracts", "Caste Certificate (for SC/ST beneficiaries)", "Aadhaar Card", "NOC from co-owners if land is joint holding", "Water availability undertaking"]'::jsonb,
  '{"mode": "ONLINE", "steps": ["Visit official MSEDCL portal mahadiscom.in/solar", "Fill A-1 application form with consumer and land details", "Upload 7/12 and caste documents", "Field survey conducted by MSEDCL engineers", "Pay beneficiary share online upon demand note issuance"], "officialPortalUrl": "https://www.mahadiscom.in/solar_MSKPY/"}'::jsonb,
  'https://www.mahadiscom.in/solar_MSKPY/',
  '[{"title": "MSEDCL Solar Pump Guidelines", "url": "https://www.mahadiscom.in", "domain": "maharashtra.gov.in", "issuingAuthority": "MSEDCL, Government of Maharashtra"}]'::jsonb,
  'ACTIVE',
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  scheme_name = EXCLUDED.scheme_name,
  description = EXCLUDED.description,
  benefits = EXCLUDED.benefits,
  eligibility_conditions = EXCLUDED.eligibility_conditions,
  required_documents = EXCLUDED.required_documents,
  application_procedure = EXCLUDED.application_procedure,
  official_url = EXCLUDED.official_url,
  status = EXCLUDED.status,
  updated_at = NOW();
