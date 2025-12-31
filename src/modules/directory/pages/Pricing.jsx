
import React from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: "0",
      features: ["5 Products Listing", "Basic Company Profile", "Email Support", "Limited Search Visibility"],
      cta: "Sign Up Free",
      active: false
    },
    {
      name: "Gold",
      price: "14,999",
      features: ["Unlimited Products", "Verified Trust Badge", "50 Buy Leads/mo", "Priority Search Ranking", "Mobile App Access"],
      cta: "Choose Gold",
      active: true
    },
    {
      name: "Platinum",
      price: "29,999",
      features: ["Everything in Gold", "Top Banner Ads", "150 Buy Leads/mo", "Dedicated Manager", "Export Inquiries"],
      cta: "Choose Platinum",
      active: false
    }
  ];

  return (
    <>
      <Helmet><title>Pricing - IndianTradeMart</title></Helmet>
      <div className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
           <h1 className="text-4xl font-bold text-center mb-4">Choose Your Growth Plan</h1>
           <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">Whether you're just starting or looking to dominate the market, we have a plan for you.</p>
           
           <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
             {plans.map((plan) => (
               <div key={plan.name} className={`bg-white rounded-2xl p-8 shadow-lg border ${plan.active ? 'border-[#059669] ring-2 ring-[#059669] ring-opacity-20' : 'border-gray-100'} relative`}>
                 {plan.active && <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED</div>}
                 <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                 <div className="mb-8">
                   <span className="text-4xl font-bold text-gray-900">₹{plan.price}</span>
                   <span className="text-gray-500">/year</span>
                 </div>
                 <Link to="/vendor/register">
                    <Button className={`w-full mb-8 h-12 ${plan.active ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-gray-900 hover:bg-gray-800'}`}>
                      {plan.cta}
                    </Button>
                 </Link>
                 <ul className="space-y-4">
                   {plan.features.map(f => (
                     <li key={f} className="flex items-start gap-3 text-sm text-gray-600">
                       <Check className="w-5 h-5 text-[#059669] flex-shrink-0" />
                       {f}
                     </li>
                   ))}
                 </ul>
               </div>
             ))}
           </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;
