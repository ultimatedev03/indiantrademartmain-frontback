
import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PackageCard = ({ name, price, features, recommended }) => (
  <div className={`relative p-8 rounded-2xl border ${
    recommended ? 'border-[#00A699] shadow-lg bg-white' : 'border-neutral-200 bg-neutral-50'
  }`}>
    {recommended && (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00A699] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
        Most Popular
      </div>
    )}
    <h3 className="font-bold text-xl mb-2">{name}</h3>
    <div className="mb-6">
      <span className="text-4xl font-bold">₹{price}</span>
      <span className="text-neutral-500">/year</span>
    </div>
    <ul className="space-y-4 mb-8">
      {features.map((feature, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-neutral-600">
          <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <Button 
      className={`w-full ${recommended ? 'bg-[#003D82]' : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'}`}
      variant={recommended ? 'default' : 'outline'}
    >
      Choose Plan
    </Button>
  </div>
);

const Packages = () => {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Upgrade Your Business</h1>
        <p className="text-neutral-500">Choose a plan that fits your growth needs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <PackageCard 
          name="Basic" 
          price="Free" 
          features={[
            "List up to 50 products",
            "Basic Analytics",
            "Email Support",
            "Limited Lead Access"
          ]} 
        />
        <PackageCard 
          name="Gold" 
          price="14,999" 
          recommended 
          features={[
            "Unlimited Products",
            "Priority Listing in Search",
            "Advanced Analytics",
            "50 Verified Leads/mo",
            "Dedicated Account Manager"
          ]} 
        />
        <PackageCard 
          name="Platinum" 
          price="29,999" 
          features={[
            "All Gold Features",
            "Top Banner Advertising",
            "100 Verified Leads/mo",
            "International Inquiries",
            "API Access"
          ]} 
        />
      </div>
    </div>
  );
};

export default Packages;
