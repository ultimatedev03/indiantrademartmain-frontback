
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const PillBreadcrumbs = ({ className, overrideParams }) => {
  const location = useLocation();
  const routeParams = useParams(); 
  
  // Use override params if provided (from SearchResults parsing), otherwise route params
  const params = overrideParams || routeParams;
  
  // Construct breadcrumb items based on route logic
  let items = [
    { label: 'IndianTradeMart', path: '/', icon: Home }
  ];

  // Logic for Directory Pages
  if (location.pathname.startsWith('/directory') || params.serviceSlug) {
    // Service
    if (params.service || params.serviceSlug) {
      const sSlug = params.service || params.serviceSlug;
      items.push({ 
        label: sSlug.replace(/-/g, ' '), 
        path: `/directory/${sSlug}` 
      });
    }
    // State
    if (params.state || params.stateSlug) {
        const sSlug = params.service || params.serviceSlug;
        const stSlug = params.state || params.stateSlug;
        if (sSlug && stSlug) {
             items.push({ 
                label: stSlug.replace(/-/g, ' '), 
                path: `/directory/${sSlug}/${stSlug}` 
            });
        }
    }
    // City
    if (params.city || params.citySlug) {
        const sSlug = params.service || params.serviceSlug;
        const stSlug = params.state || params.stateSlug;
        const cSlug = params.city || params.citySlug;
        
        if (sSlug && stSlug && cSlug) {
            items.push({ 
                label: cSlug.replace(/-/g, ' '), 
                path: `/directory/${sSlug}/${stSlug}/${cSlug}` 
            });
        }
    }
  } 
  // Logic for standard Categories
  else if (location.pathname.startsWith('/categories')) {
      items.push({ label: 'All Categories', path: '/categories' });
      if (params.slug) {
         items.push({ 
            label: params.slug.replace(/-/g, ' '), 
            path: `/categories/${params.slug}` 
         });
      }
  }

  return (
    <nav className={cn("w-full overflow-x-auto pb-2 scrollbar-hide", className)} aria-label="Breadcrumb">
      <div className="flex items-center space-x-2 whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <React.Fragment key={item.path}>
              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              
              <Link 
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                  isLast 
                    ? "bg-[#003D82] text-white border-[#003D82] hover:bg-[#002a5c]" 
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                {Icon && <Icon className="w-3 h-3 mr-1.5" />}
                <span className="capitalize">{item.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default PillBreadcrumbs;
