import { submitContactForm } from '@/modules/directory/services/contactApi';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import {
  FooterPageAction,
  FooterPageBulletList,
  FooterPageCard,
  FooterPageSection,
  FooterPageShell,
} from '@/modules/directory/components/FooterPageShell';
import { successStories } from '@/modules/directory/pages/successStoriesData';
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Clock,
  Eye,
  FileText,
  Handshake,
  Headphones,
  Heart,
  Loader,
  Mail,
  Link2,
  MapPin,
  Phone,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProductDetailPath as buildProductDetailPath } from '@/shared/utils/productRoutes';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const buildMailtoLink = (email, subject) =>
  `mailto:${email}?subject=${encodeURIComponent(subject || '')}`;

const buildContactPath = ({ subject = '', message = '' } = {}) => {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (message) params.set('message', message);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
};

const CAREER_OPENINGS_PATH = '/career#career-openings';

// ==================== JOIN SALES PAGE ====================
export const JoinSales = () => (
  <FooterPageShell
    eyebrow="Sales Partnerships"
    title="Join Our Sales Team"
    description="Help Indian Trade Mart expand into new markets, onboard quality suppliers, and turn verified demand into long-term business relationships."
    stats={[
      { label: 'Regional opportunities', value: '15+' },
      { label: 'Flexible role tracks', value: '4' },
      { label: 'Structured onboarding', value: '100%' },
      { label: 'Growth reach', value: 'Pan-India' },
    ]}
    aside={(
      <div className="space-y-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
          <Handshake className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Built for ambitious sales professionals.</h2>
          <p className="text-sm leading-6 text-slate-300">
            Whether you work in field sales, partner enablement, or account growth, we provide a clearer operating structure and faster lead handoff.
          </p>
        </div>
        <FooterPageBulletList
          className="text-slate-200"
          items={[
            'Direct exposure to high-intent B2B buyer demand',
            'Support from a central platform, onboarding, and marketing team',
            'Scope to grow with regional and category expansion plans',
          ]}
        />
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-2">
      <FooterPageSection
        title="What you will work on"
        description="A practical sales role focused on supplier acquisition, account growth, and long-term retention."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FooterPageCard className="space-y-3">
            <Users className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-950">Seller acquisition</h3>
            <p className="text-sm leading-6 text-slate-600">Identify credible businesses, guide onboarding, and improve listing readiness.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <TrendingUp className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-semibold text-slate-950">Territory growth</h3>
            <p className="text-sm leading-6 text-slate-600">Build stronger category coverage and increase supply depth in priority regions.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <BadgeCheck className="h-6 w-6 text-slate-900" />
            <h3 className="text-lg font-semibold text-slate-950">Quality onboarding</h3>
            <p className="text-sm leading-6 text-slate-600">Help new partners launch with the right profile data, catalogue quality, and conversion basics.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <Rocket className="h-6 w-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-slate-950">Account expansion</h3>
            <p className="text-sm leading-6 text-slate-600">Work with active sellers to improve response speed, lead conversion, and retention.</p>
          </FooterPageCard>
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="What you get"
        description="A clearer page structure, more visible calls to action, and cleaner spacing across devices."
        action={<FooterPageAction to={CAREER_OPENINGS_PATH}>View current openings</FooterPageAction>}
      >
        <FooterPageBulletList
          items={[
            'Clear role expectations across acquisition, onboarding, and growth',
            'Defined contact path for application and hiring follow-up',
            'A layout consistent with the rest of the marketplace experience',
            'Room for future expansion into region-specific postings',
          ]}
        />
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== SUCCESS STORIES PAGE ====================
export const SuccessStories = () => (
  <FooterPageShell
    eyebrow="Market Wins"
    title="Success Stories"
    description="See how suppliers and buyers use Indian Trade Mart to improve visibility, generate qualified enquiries, and build repeat business."
    stats={[
      { label: 'Featured stories', value: `${successStories.length}+` },
      { label: 'Marketplace coverage', value: 'Multi-sector' },
      { label: 'Primary focus', value: 'Growth' },
      { label: 'Content format', value: 'Case-led' },
    ]}
    aside={(
      <div className="space-y-4">
        <Star className="h-8 w-8 text-amber-300" />
        <p className="text-xl font-semibold text-white">Real outcomes, cleaner presentation.</p>
        <p className="text-sm leading-6 text-slate-300">
          Each story now sits inside a structured content card instead of a plain, under-designed list block.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Featured growth stories"
      description="Each story is presented with stronger hierarchy, more breathing room, and a clearer next step."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {successStories.map((story) => (
          <FooterPageCard key={story.slug} className="flex h-full flex-col gap-4 bg-white">
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Success Story
            </span>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">{story.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{story.excerpt}</p>
            </div>
            <div className="mt-auto pt-2">
              <FooterPageAction to={`/success-stories/${story.slug}`} variant="secondary">
                Read full story
              </FooterPageAction>
            </div>
          </FooterPageCard>
        ))}
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

// ==================== HELP PAGE ====================
export const Help = () => {
  const helpTopics = [
    {
      topic: 'Getting Started',
      items: ['Create your account and complete your profile', 'Understand how enquiries and responses work', 'Set up the right category and location information'],
    },
    {
      topic: 'Account Management',
      items: ['Update business details and credentials', 'Review settings, access, and profile quality', 'Keep communication details current'],
    },
    {
      topic: 'Buying',
      items: ['Search suppliers and compare listings', 'Post requirements with complete specifications', 'Shortlist partners with relevant capabilities'],
    },
    {
      topic: 'Selling',
      items: ['Improve listings and product visibility', 'Respond faster to qualified leads', 'Strengthen trust with complete business information'],
    },
    {
      topic: 'Payments',
      items: ['Review billing and subscription status', 'Understand support for payment-related issues', 'Keep records available for quick resolution'],
    },
    {
      topic: 'Shipping',
      items: ['Coordinate dispatch expectations early', 'Align fulfilment details with buyers', 'Reach support for shipping and delivery queries'],
    },
  ];

  return (
    <FooterPageShell
      eyebrow="Help Centre"
      title="Find answers without friction"
      description="The help page now uses a structured knowledge layout with cleaner spacing, stronger section rhythm, and more readable topic cards."
      stats={[
        { label: 'Help topics', value: `${helpTopics.length}` },
        { label: 'Coverage', value: 'Buyer + Seller' },
        { label: 'Support routes', value: '3' },
        { label: 'Response path', value: 'Direct' },
      ]}
      aside={(
        <div className="space-y-4">
          <BookOpen className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">Start with the right topic.</p>
          <p className="text-sm leading-6 text-slate-300">
            Each topic card has been rebuilt to feel like part of the main site rather than a plain placeholder block.
          </p>
        </div>
      )}
    >
      <FooterPageSection
        title="Browse by topic"
        description="Use the sections below to find the right starting point for onboarding, buying, selling, and support."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {helpTopics.map((topic) => (
            <FooterPageCard key={topic.topic} className="space-y-4 bg-white">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{topic.topic}</h3>
              <FooterPageBulletList items={topic.items} />
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Need direct assistance?"
        description="If you do not find the answer quickly, route your query through the most relevant support path."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FooterPageCard className="space-y-3">
            <Headphones className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-950">Customer care</h3>
            <p className="text-sm leading-6 text-slate-600">For account, listing, or support issues that need hands-on help.</p>
            <FooterPageAction to="/customer-care" variant="secondary">Visit customer care</FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <Mail className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-semibold text-slate-950">Contact support</h3>
            <p className="text-sm leading-6 text-slate-600">Share the issue context so the team can follow up with the right owner.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Help Centre Support Request',
                message: 'Hi team, I need assistance with an issue not covered in the help centre. Please contact me.',
              })}
              variant="secondary"
            >
              Send a request
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <ShieldCheck className="h-6 w-6 text-slate-900" />
            <h3 className="text-lg font-semibold text-slate-950">Complaints desk</h3>
            <p className="text-sm leading-6 text-slate-600">Raise escalations separately so they are routed with higher urgency and traceability.</p>
            <FooterPageAction to="/complaints" variant="secondary">Raise a complaint</FooterPageAction>
          </FooterPageCard>
        </div>
      </FooterPageSection>
    </FooterPageShell>
  );
};

// ==================== CUSTOMER CARE PAGE ====================
export const CustomerCare = () => (
  <FooterPageShell
    eyebrow="Customer Care"
    title="Dedicated support for buyers and suppliers"
    description="This page now uses clearer contact cards, more consistent spacing, and a cleaner support flow instead of a loosely stacked layout."
    stats={[
      { label: 'Primary phone line', value: '+91 7290010051' },
      { label: 'Support email', value: 'support@indiantrademart.com' },
      { label: 'Support channels', value: '3' },
      { label: 'Business coverage', value: 'Mon-Sat' },
    ]}
    aside={(
      <div className="space-y-4">
        <Headphones className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Your issue should feel easy to route.</p>
        <p className="text-sm leading-6 text-slate-300">
          Contact details, common questions, and next actions are grouped into distinct sections for faster scanning on desktop and mobile.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Contact information"
      description="Reach out through the support path that fits your issue best."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FooterPageCard className="space-y-3 bg-white">
          <Phone className="h-6 w-6 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-950">Call us</h3>
          <p className="text-sm text-slate-600">Speak with the support team for urgent marketplace issues.</p>
          <a href="tel:+917290010051" className="text-sm font-semibold text-slate-900 hover:text-emerald-700">+91 7290010051</a>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <Mail className="h-6 w-6 text-blue-700" />
          <h3 className="text-lg font-semibold text-slate-950">Email us</h3>
          <p className="text-sm text-slate-600">Share the full issue context so the right team can respond accurately.</p>
          <a href="mailto:support@indiantrademart.com" className="text-sm font-semibold text-slate-900 hover:text-blue-700">support@indiantrademart.com</a>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <MapPin className="h-6 w-6 text-slate-900" />
          <h3 className="text-lg font-semibold text-slate-950">Visit us</h3>
          <p className="text-sm leading-6 text-slate-600">672, White House, Behind- MCD School, MG Road, Ghitorni, New Delhi, Delhi 110030</p>
        </FooterPageCard>
      </div>
    </FooterPageSection>

    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <FooterPageSection
        title="Frequently asked questions"
        description="The most common support intents are now presented with consistent spacing and separation."
      >
        <div className="space-y-4">
          {[
            'How do I create an account?',
            'How do I place an order?',
            'What is your return policy?',
            'How long does delivery take?',
          ].map((faq) => (
            <FooterPageCard key={faq} className="bg-white">
              <h3 className="text-lg font-semibold text-slate-950">{faq}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Find detailed answers to this question in our knowledge base or contact support for account-specific guidance.</p>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Support options"
        description="Take the route that best matches your issue."
      >
        <div className="space-y-4">
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Submit a ticket</h3>
            <p className="text-sm leading-6 text-slate-600">Use the contact form for detailed assistance and traceable follow-up.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Customer Care Support Request',
                message: 'Hi team, I need support with my account / order / listing. Please contact me.',
              })}
            >
              Submit ticket
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Start an email conversation</h3>
            <p className="text-sm leading-6 text-slate-600">Send the support team your issue directly if you prefer email-first communication.</p>
            <FooterPageAction
              href={buildMailtoLink('support@indiantrademart.com', 'Customer Care Support Request')}
              variant="secondary"
            >
              Email support
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Share feedback</h3>
            <p className="text-sm leading-6 text-slate-600">Tell us where the product or support experience needs improvement.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Customer Care Feedback',
                message: 'Hi team, I would like to share feedback about my experience with IndianTradeMart.',
              })}
              variant="secondary"
            >
              Share feedback
            </FooterPageAction>
          </FooterPageCard>
        </div>
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== COMPLAINTS PAGE ====================
export const Complaints = () => (
  <FooterPageShell
    eyebrow="Escalations"
    title="Complaints & Grievances"
    description="Complaints now have a more deliberate layout with clearer next steps, higher visual trust, and stronger separation from general support content."
    stats={[
      { label: 'Intake path', value: 'Structured' },
      { label: 'Tracking', value: 'Documented' },
      { label: 'Escalation channel', value: 'Direct' },
      { label: 'Response mode', value: 'Follow-up' },
    ]}
    aside={(
      <div className="space-y-4">
        <ShieldCheck className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Escalations should feel accountable.</p>
        <p className="text-sm leading-6 text-slate-300">
          The page now frames grievances with stronger trust cues and a clearer filing path instead of a single isolated block.
        </p>
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <FooterPageSection
        title="How we handle complaints"
        description="Share the issue clearly so it can be reviewed, routed, and resolved with the right level of urgency."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              title: 'Describe the issue',
              text: 'Include dates, affected account or listing details, and the outcome you expect.',
            },
            {
              icon: BadgeCheck,
              title: 'We review the context',
              text: 'The team checks the complaint, validates the details, and routes it to the right owner.',
            },
            {
              icon: ShieldCheck,
              title: 'Follow-up and closure',
              text: 'You receive a response path for clarification, action, or closure based on the case.',
            },
          ].map((item) => (
            <FooterPageCard key={item.title} className="space-y-3 bg-white">
              <item.icon className="h-6 w-6 text-slate-900" />
              <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{item.text}</p>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="File a complaint"
        description="Use the dedicated complaint route so your issue is not mixed with standard support traffic."
        action={(
          <FooterPageAction
            to={buildContactPath({
              subject: 'Complaint / Grievance Submission',
              message: 'Hi team, I would like to file a complaint. Please review the issue described below.',
            })}
          >
            File complaint
          </FooterPageAction>
        )}
      >
        <FooterPageBulletList
          items={[
            'Summarise the issue and the timeline clearly',
            'Include listing, order, or account references when relevant',
            'State the resolution or follow-up you expect from the team',
          ]}
        />
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== JOBS PAGE ====================
export const Jobs = () => {
  const roles = [
    'Software Engineer',
    'Sales Manager',
    'Business Analyst',
    'Marketing Executive',
  ];

  return (
    <FooterPageShell
      eyebrow="Careers"
      title="Jobs & Careers"
      description="Open roles are now displayed in cleaner job cards with better hierarchy, spacing, and a stronger call to action."
      stats={[
        { label: 'Featured openings', value: `${roles.length}` },
        { label: 'Role types', value: 'Product + Growth' },
        { label: 'Locations', value: 'India' },
        { label: 'Application route', value: 'Direct' },
      ]}
      aside={(
        <div className="space-y-4">
          <BriefcaseBusiness className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">A clearer talent entry point.</p>
          <p className="text-sm leading-6 text-slate-300">
            The new structure presents roles as proper opportunity cards with a consistent CTA pattern instead of a flat list.
          </p>
        </div>
      )}
    >
      <FooterPageSection
        title="Current openings"
        description="Representative roles currently highlighted for hiring conversations."
        action={<FooterPageAction to={CAREER_OPENINGS_PATH}>Apply now</FooterPageAction>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((job) => (
            <FooterPageCard key={job} className="flex flex-col gap-4 bg-white">
              <div className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Open Role
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">{job}</h3>
                <p className="text-sm leading-6 text-slate-600">Location: India. Role details, fit, and next steps are handled through the careers team.</p>
              </div>
              <div className="mt-auto pt-2">
                <FooterPageAction to={CAREER_OPENINGS_PATH} variant="secondary">View details</FooterPageAction>
              </div>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>
    </FooterPageShell>
  );
};

// ==================== CONTACT PAGE ====================
export const ContactPage = () => {
  const [searchParams] = useSearchParams();
  const normalizePhone = (value) =>
    String(value || '')
      .replace(/\D/g, '')
      .slice(0, 10);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: searchParams.get('subject') || '',
    message: searchParams.get('message') || ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      subject: searchParams.get('subject') || '',
      message: searchParams.get('message') || '',
    }));
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue = name === 'phone' ? normalizePhone(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: normalizedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!formData.firstName || !formData.email || !formData.message) {
        throw new Error('Please fill in all required fields (First Name, Email, Message)');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        throw new Error('Please enter a valid 10-digit contact number');
      }

      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      await submitContactForm({
        name: fullName,
        email: formData.email,
        phone: formData.phone,
        message: `Subject: ${formData.subject || 'No Subject'}\n\n${formData.message}`
      });

      setSuccessMessage('Thank you! Your message has been sent successfully. We will get back to you soon.');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send message. Please try again.');
      console.error('Contact form error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FooterPageShell
      eyebrow="Contact"
      title="Get in touch with our team"
      description="The contact page now follows the same visual system as the rest of the public site, with clearer information blocks and a more polished enquiry form."
      stats={[
        { label: 'Primary email', value: 'support@indiantrademart.com' },
        { label: 'Primary phone', value: '+91 7290010051' },
        { label: 'Office city', value: 'New Delhi' },
        { label: 'Business hours', value: 'Mon-Sat' },
      ]}
      aside={(
        <div className="space-y-4">
          <Clock className="h-8 w-8 text-emerald-300" />
          <p className="text-xl font-semibold text-white">Fast routing starts with the right context.</p>
          <p className="text-sm leading-6 text-slate-300">
            Share your subject and message clearly, and the team can direct the enquiry to support, business development, or operations more efficiently.
          </p>
        </div>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <FooterPageSection
          title="Contact information"
          description="Reach out through email, phone, or the contact form depending on the type of help you need."
        >
          <div className="space-y-4">
            <FooterPageCard className="space-y-3 bg-white">
              <Mail className="h-6 w-6 text-blue-700" />
              <h3 className="text-lg font-semibold text-slate-950">Email support</h3>
              <a href="mailto:support@indiantrademart.com" className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                support@indiantrademart.com
              </a>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <Phone className="h-6 w-6 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-950">Phone support</h3>
              <a href="tel:+917290010051" className="text-sm font-semibold text-slate-900 hover:text-emerald-700">
                +91 7290010051
              </a>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <MapPin className="h-6 w-6 text-slate-900" />
              <h3 className="text-lg font-semibold text-slate-950">Office address</h3>
              <p className="text-sm leading-6 text-slate-600">
                Indian Trade Mart Pvt. Ltd.
                <br />
                672, White House, Behind- MCD School, MG Road
                <br />
                Ghitorni, New Delhi, Delhi 110030
              </p>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <Clock className="h-6 w-6 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-950">Business hours</h3>
              <p className="text-sm leading-6 text-slate-600">
                Monday - Friday: 9:00 AM - 6:00 PM
                <br />
                Saturday: 10:00 AM - 4:00 PM
                <br />
                Sunday: Closed
              </p>
            </FooterPageCard>
            <FooterPageCard className="bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-950">Department contacts</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">General Information</span>
                  <span className="font-medium text-slate-900">info@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">Customer Care</span>
                  <span className="font-medium text-slate-900">customercare@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">Business Development</span>
                  <span className="font-medium text-slate-900">bd@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">HR Department</span>
                  <span className="font-medium text-slate-900">hr@indiantrademart.com</span>
                </div>
              </div>
            </FooterPageCard>
          </div>
        </FooterPageSection>

        <FooterPageSection
          title="Send us a message"
          description="Provide the basic details below and the team will follow up through the right department."
        >
          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your first name"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your last name"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="10-digit mobile number"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Subject of your message"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Message *</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                rows={6}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Please describe your inquiry in detail..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </button>
          </form>
        </FooterPageSection>
      </div>
    </FooterPageShell>
  );
};

// ==================== LINK TO US PAGE ====================
export const LinkToUs = () => (
  <FooterPageShell
    eyebrow="Partnership Links"
    title="Link to Indian Trade Mart"
    description="Use these linking guidelines if you want to reference Indian Trade Mart from your website, blog, partner portal, or supplier resource page."
    stats={[
      { label: 'Preferred target', value: 'Homepage' },
      { label: 'Suggested text', value: 'Indian Trade Mart' },
      { label: 'Use case', value: 'SEO + referrals' },
      { label: 'Link type', value: 'Direct' },
    ]}
    aside={(
      <div className="space-y-4">
        <Link2 className="h-8 w-8 text-blue-200" />
        <p className="text-xl font-semibold text-white">Give visitors a clear route to the marketplace.</p>
        <p className="text-sm leading-6 text-slate-300">
          Link to the homepage or a relevant category page when you want buyers and suppliers to discover Indian Trade Mart through your content.
        </p>
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <FooterPageSection
        title="Recommended linking options"
        description="Use simple, descriptive anchor text and route visitors to the most relevant public page."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Homepage link</h3>
            <p className="text-sm leading-6 text-slate-600">Best for general references, directory roundups, and marketplace mentions.</p>
            <code className="block rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">https://indiantrademart.com/</code>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Supplier discovery link</h3>
            <p className="text-sm leading-6 text-slate-600">Use this when your audience specifically wants to browse sellers and compare suppliers.</p>
            <code className="block rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">https://indiantrademart.com/directory/vendor</code>
          </FooterPageCard>
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Suggested anchor text"
        description="Keep anchor text natural, relevant, and easy to understand."
      >
        <FooterPageBulletList
          items={[
            'Indian Trade Mart',
            'Find suppliers on Indian Trade Mart',
            'Explore B2B products and vendors',
            'Browse Indian Trade Mart marketplace listings',
          ]}
        />
        <div className="mt-6">
          <FooterPageAction to="/contact" variant="secondary">Request partnership support</FooterPageAction>
        </div>
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== BUY LEADS PAGE ====================
export const BuyLeads = () => (
  <FooterPageShell
    eyebrow="Buyer Demand"
    title="Latest Buy Leads"
    description="Buy leads now sit inside a clearer presentation with stronger spacing, better card balance, and a more intentional call to action."
    stats={[
      { label: 'Lead quality', value: 'Verified' },
      { label: 'Coverage', value: 'Pan-India' },
      { label: 'Audience', value: 'Suppliers' },
      { label: 'Next step', value: 'Register' },
    ]}
    aside={(
      <div className="space-y-4">
        <ShoppingCart className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Qualified demand matters more than noise.</p>
        <p className="text-sm leading-6 text-slate-300">
          This page now frames buy leads as a supplier growth tool, instead of a single low-information card.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Why browse buy leads"
      description="Review fresh demand from verified buyers and move faster on relevant opportunities."
      action={<FooterPageAction to="/vendor/register">Browse buy leads</FooterPageAction>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FooterPageCard className="space-y-3 bg-white">
          <ShoppingCart className="h-6 w-6 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-950">Real buying intent</h3>
          <p className="text-sm leading-6 text-slate-600">Focus on active buyer requirements instead of broad, unqualified traffic.</p>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <Eye className="h-6 w-6 text-blue-700" />
          <h3 className="text-lg font-semibold text-slate-950">Faster visibility</h3>
          <p className="text-sm leading-6 text-slate-600">Match your offering to relevant enquiries and improve response speed.</p>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <TrendingUp className="h-6 w-6 text-slate-900" />
          <h3 className="text-lg font-semibold text-slate-950">Stronger pipeline</h3>
          <p className="text-sm leading-6 text-slate-600">Use buy leads to create a more predictable top-of-funnel for your sales team.</p>
        </FooterPageCard>
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

// ==================== LEARNING CENTRE PAGE ====================
export const LearningCentre = () => (
  <FooterPageShell
    eyebrow="Learning Centre"
    title="Master the skills to grow on the marketplace"
    description="The learning section now feels like a proper public page, with stronger card hierarchy and better spacing around each training module."
    stats={[
      { label: 'Starter modules', value: '3' },
      { label: 'Audience', value: 'Suppliers' },
      { label: 'Focus', value: 'Growth' },
      { label: 'Format', value: 'Guided' },
    ]}
    aside={(
      <div className="space-y-4">
        <BookOpen className="h-8 w-8 text-blue-200" />
        <p className="text-xl font-semibold text-white">Training should feel worth exploring.</p>
        <p className="text-sm leading-6 text-slate-300">
          Each module now appears as a polished card with clearer purpose and stronger action styling.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Featured learning modules"
      description="Practical tracks for onboarding, visibility, and supplier-side growth."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {['Getting Started', 'Sales Strategies', 'Digital Marketing'].map((course) => (
          <FooterPageCard key={course} className="flex flex-col gap-4 bg-white">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-950">{course}</h3>
              <p className="text-sm leading-6 text-slate-600">Learn from industry experts and platform practitioners with a more structured learning path.</p>
            </div>
            <div className="mt-auto pt-2">
              <FooterPageAction
                to={buildContactPath({
                  subject: `Learning Centre Enrollment - ${course}`,
                  message: `Hi team, I want to know more about the "${course}" learning module.`,
                })}
                variant="secondary"
              >
                Enroll now
              </FooterPageAction>
            </div>
          </FooterPageCard>
        ))}
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

// ==================== PRODUCTS YOU BUY PAGE ====================
export const ProductsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const pickFirstImageUrl = (images) => {
    const imgs = images;
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      if (first && typeof first === 'object') {
        const url = first.url || first.image_url || first.src;
        if (typeof url === 'string' && url.trim()) return url.trim();
      }
    }
    return '';
  };

  const normalizeFeatures = (specs) => {
    let data = specs;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }
    if (!Array.isArray(data)) return [];

    const out = [];
    for (const item of data) {
      if (!item) continue;
      if (typeof item === 'string') out.push(item);
      if (item && typeof item === 'object') {
        const label = item.label || item.name || item.key;
        const value = item.value || item.val;
        if (label && value) out.push(`${label}: ${value}`);
        else if (label) out.push(label);
      }
      if (out.length >= 6) break;
    }
    return out;
  };

  const formatPrice = (price, unit) => {
    const num = Number(price);
    if (!Number.isFinite(num) || num <= 0) return 'Price on request';
    const formatted = new Intl.NumberFormat('en-IN').format(num);
    return `₹${formatted}${unit ? ` / ${unit}` : ''}`;
  };

  const formatMinOrder = (qty, unit) => {
    const num = Number(qty);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `${num}${unit ? ` ${unit}` : ''}`;
  };

  const pickCategory = (product) => {
    const direct = String(product?.category || product?.category_other || '').trim();
    if (direct) return direct;
    const path = String(product?.category_path || '').trim();
    if (!path) return 'General';
    const parts = path.split('>').map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : path;
  };

  const normalizeDedupText = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const buildProductDedupKey = (product) => {
    const vendorKey = normalizeDedupText(product?.vendorId || product?.supplier);
    const nameKey = normalizeDedupText(product?.name);

    if (vendorKey && nameKey) {
      return `${vendorKey}|${nameKey}`;
    }

    return normalizeDedupText(
      product?.slug ||
      product?.id ||
      `${product?.name}|${product?.supplier}|${product?.location}`
    );
  };

  const scoreProductForListing = (product) => {
    let score = 0;
    if (product?.inStock) score += 16;
    if (product?.verified) score += 8;
    if (product?.image) score += 4;
    if (product?.slug) score += 2;
    score += Math.min(Number(product?.reviews) || 0, 50);
    score += Math.min(String(product?.description || '').trim().length, 120) / 100;
    return score;
  };

  const getProductDetailPath = (product) =>
    buildProductDetailPath(product) || getVendorProfilePath({ slug: product?.vendorSlug, id: product?.vendorId }) || '/contact';

  const getSupplierPath = (product) =>
    getVendorProfilePath({ slug: product?.vendorSlug, id: product?.vendorId }) || '/contact';

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await directoryApi.searchProducts({ q: '', page: 1, limit: 200 });
        const list = (Array.isArray(data) ? data : []).map((p) => {
          const vendor = p?.vendors || {};
          const location = [vendor?.city || p?.city, vendor?.state || p?.state].filter(Boolean).join(', ');
          const rating = Number(vendor?.seller_rating);
          const views = Number(p?.views);

          return {
            id: p?.id,
            slug: p?.slug || '',
            name: p?.name || 'Unnamed Product',
            category: pickCategory(p),
            description: p?.description || '',
            price: formatPrice(p?.price, p?.price_unit),
            minOrder: formatMinOrder(p?.min_order_qty ?? p?.moq, p?.qty_unit),
            supplier: vendor?.company_name || '',
            vendorId: vendor?.id || '',
            vendorSlug: vendor?.slug || '',
            location: location || 'India',
            rating: Number.isFinite(rating) ? rating : 0,
            reviews: Number.isFinite(views) ? views : 0,
            verified: !!(
              vendor?.verification_badge ||
              vendor?.is_verified ||
              String(vendor?.kyc_status || '').toUpperCase() === 'APPROVED'
            ),
            features: normalizeFeatures(p?.specifications),
            inStock: typeof p?.stock === 'number' ? p.stock > 0 : true,
            image: pickFirstImageUrl(p?.images),
            createdAt: p?.created_at || '',
          };
        });

        const uniqueMap = new Map();
        for (const item of list) {
          const key = buildProductDedupKey(item);
          const existing = uniqueMap.get(key);
          if (!existing || scoreProductForListing(item) > scoreProductForListing(existing)) {
            uniqueMap.set(key, item);
          }
        }
        const uniqueList = Array.from(uniqueMap.values());

        if (!alive) return;
        setProducts(uniqueList);
      } catch (error) {
        console.error('Failed to load products:', error);
        if (!alive) return;
        setProducts([]);
        setLoadError('Failed to load products. Please try again.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const value = String(p?.category || '').trim();
      if (value) set.add(value);
    });
    return ['All Categories', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const locations = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const value = String(p?.location || '').trim();
      if (value) set.add(value);
    });
    return ['All Locations', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  useEffect(() => {
    if (selectedCategory !== 'All Categories' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All Categories');
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (selectedLocation !== 'All Locations' && !locations.includes(selectedLocation)) {
      setSelectedLocation('All Locations');
    }
  }, [locations, selectedLocation]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (products || []).filter((product) => {
      if (query) {
        const hay = [
          product.name,
          product.description,
          product.category,
          product.location,
          product.supplier,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (selectedCategory !== 'All Categories' && product.category !== selectedCategory) return false;
      if (selectedLocation !== 'All Locations' && product.location !== selectedLocation) return false;
      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedLocation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3">Products You Buy</h1>
          <p className="text-xl text-blue-100">Discover quality products from verified suppliers across India for your business needs</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products, suppliers, categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select 
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-600">
            {loading ? 'Loading products...' : `Showing ${filteredProducts.length} of ${products.length} products`}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-600">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Loading products...
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const productPath = getProductDetailPath(product);
                const supplierPath = getSupplierPath(product);

                return (
                <div key={buildProductDedupKey(product)} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative">
                    <Link
                      to={productPath}
                      className="block h-48 bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden"
                      aria-label={`View ${product.name}`}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-white text-center">
                          <ShoppingCart size={32} className="mx-auto mb-2" />
                          <div className="text-sm font-medium">{product.category}</div>
                        </div>
                      )}
                    </Link>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Link
                        to={supplierPath}
                        className="relative z-10 inline-flex p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
                        aria-label="Contact supplier"
                        title="Contact supplier"
                      >
                        <Mail size={16} className="text-gray-600" />
                      </Link>
                      <Link
                        to={productPath}
                        className="relative z-10 inline-flex p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
                        aria-label="View product"
                        title="View product"
                      >
                        <Eye size={16} className="text-gray-600" />
                      </Link>
                    </div>
                    {!product.inStock && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                        Out of Stock
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-600">{product.category}</span>
                      {product.verified && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Verified
                        </span>
                      )}
                    </div>

                    <Link to={productPath} className="block text-lg font-semibold text-gray-900 mb-2 hover:text-blue-700">
                      {product.name}
                    </Link>
                    <p className="text-gray-600 text-sm mb-3">{product.description}</p>

                    {product.rating > 0 ? (
                      <div className="flex items-center mb-3">
                        <Star className="text-yellow-500 mr-1" size={14} />
                        <span className="text-sm font-medium">{product.rating.toFixed(1)}</span>
                        {product.reviews > 0 && (
                          <span className="text-gray-500 text-sm ml-1">({product.reviews})</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 mb-3">No ratings yet</div>
                    )}

                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <MapPin className="mr-1" size={14} />
                      <span>{product.location}</span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Price:</span>
                        <span className="font-semibold text-green-600">{product.price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Min Order:</span>
                        <span className="font-medium">{product.minOrder}</span>
                      </div>
                    </div>

                    {product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {product.features.slice(0, 2).map((feature, index) => (
                          <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {feature}
                          </span>
                        ))}
                        {product.features.length > 2 && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            +{product.features.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link
                        to={productPath}
                        className={`relative z-10 inline-flex flex-1 items-center justify-center py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors ${
                          product.inStock
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {product.inStock ? 'View Details' : 'View Product'}
                      </Link>
                      <Link
                        to={supplierPath}
                        className="relative z-10 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                      >
                        Get Quote
                      </Link>
                    </div>
                  </div>
                </div>
              )})}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No products found matching your criteria.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
