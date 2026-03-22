import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Search, ShieldCheck, TrendingUp } from 'lucide-react';

const insightCards = [
  {
    title: 'How to shortlist reliable suppliers faster',
    category: 'Sourcing',
    readTime: '5 min read',
    description:
      'A practical framework for comparing supplier listings, profile completeness, and response quality before you reach out.',
    cta: '/directory/vendor',
    label: 'Browse suppliers',
  },
  {
    title: 'What makes a high-converting vendor profile',
    category: 'Seller Growth',
    readTime: '6 min read',
    description:
      'Profile quality, product clarity, and faster enquiry response all shape how buyers perceive a supplier on a B2B marketplace.',
    cta: '/become-a-vendor',
    label: 'Sell on Trade Mart',
  },
  {
    title: 'Why city-level supplier discovery matters',
    category: 'Market Coverage',
    readTime: '4 min read',
    description:
      'Regional discovery can reduce fulfilment friction and help sourcing teams find better-fit suppliers in the right business hubs.',
    cta: '/directory/cities',
    label: 'Explore cities',
  },
];

const highlights = [
  {
    icon: Search,
    title: 'Marketplace know-how',
    description: 'Guides focused on supplier discovery, product visibility, and practical B2B buying workflows.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust and quality',
    description: 'Insights around verification, response discipline, and profile quality across the marketplace.',
  },
  {
    icon: TrendingUp,
    title: 'Growth ideas',
    description: 'Content for suppliers and buyers who want to improve visibility, conversion, and business readiness.',
  },
];

const Blog = () => {
  return (
    <div className="bg-slate-50">
      <Helmet>
        <title>Blog & Insights | Indian Trade Mart</title>
        <meta
          name="description"
          content="Explore Indian Trade Mart blog and insights for B2B sourcing, supplier discovery, seller growth, and marketplace best practices."
        />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Blog & Insights
              </span>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Insights for buyers, suppliers, and teams operating on the marketplace.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                This section gives Indian Trade Mart a first-party content hub for marketplace guidance, sourcing
                ideas, and supplier growth topics instead of routing visitors to an off-site blog.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <BookOpen className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">What you will find here</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Content focused on sourcing strategy, supplier presentation, trust signals, marketplace operations, and
                category-led growth opportunities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">Featured Insights</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Start with these marketplace reads.</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {insightCards.map((card) => (
            <article key={card.title} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span>{card.category}</span>
                <span>{card.readTime}</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{card.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{card.description}</p>
              <div className="mt-auto pt-6">
                <Link
                  to={card.cta}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                >
                  {card.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Blog;
