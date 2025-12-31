
import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/shared/components/Logo';
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-white pt-16 pb-8 border-t border-slate-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="space-y-6">
            <Logo variant="light" />
            <p className="text-slate-400 text-sm leading-relaxed">
              India's premier B2B marketplace connecting verified buyers with genuine suppliers. Empowering businesses with digital tools for global trade.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-300"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-blue-400 hover:text-white transition-all duration-300"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-blue-700 hover:text-white transition-all duration-300"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-pink-600 hover:text-white transition-all duration-300"><Instagram className="w-5 h-5" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Company</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link to="/about-us" className="hover:text-blue-400 transition-colors inline-flex items-center"><ArrowRight className="w-3 h-3 mr-2 opacity-0 hover:opacity-100 transition-opacity" /> About Us</Link></li>
              <li><Link to="/pricing" className="hover:text-blue-400 transition-colors inline-flex items-center"><ArrowRight className="w-3 h-3 mr-2 opacity-0 hover:opacity-100 transition-opacity" /> Pricing Plans</Link></li>
              <li><Link to="/success-stories" className="hover:text-blue-400 transition-colors inline-flex items-center"><ArrowRight className="w-3 h-3 mr-2 opacity-0 hover:opacity-100 transition-opacity" /> Success Stories</Link></li>
              <li><Link to="/careers" className="hover:text-blue-400 transition-colors inline-flex items-center"><ArrowRight className="w-3 h-3 mr-2 opacity-0 hover:opacity-100 transition-opacity" /> Careers</Link></li>
              <li><Link to="/employee/auth/login" className="hover:text-blue-400 transition-colors inline-flex items-center"><ArrowRight className="w-3 h-3 mr-2 opacity-0 hover:opacity-100 transition-opacity" /> Employee Login</Link></li>
            </ul>
          </div>

          {/* For Businesses */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Services</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link to="/vendor/register" className="hover:text-blue-400 transition-colors">Sell on Platform</Link></li>
              <li><Link to="/buyer/register" className="hover:text-blue-400 transition-colors">Buy on Platform</Link></li>
              <li><Link to="/help" className="hover:text-blue-400 transition-colors">Seller Support Center</Link></li>
              <li><Link to="/categories" className="hover:text-blue-400 transition-colors">Browse Categories</Link></li>
              <li><Link to="/logistics" className="hover:text-blue-400 transition-colors">Logistics Services</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Get in Touch</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>Tech Park Plaza, Sector 62,<br />Noida - 201309, India</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <span>+91 1800-123-4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <span>support@indiantrademart.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Indian Trade Mart. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link to="/security" className="hover:text-white transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
