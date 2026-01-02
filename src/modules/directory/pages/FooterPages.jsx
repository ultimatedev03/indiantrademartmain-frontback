import { submitContactForm } from '@/modules/directory/services/contactApi';
import { Clock, Eye, Heart, Loader, Mail, MapPin, Phone, Search, ShoppingCart, Star } from 'lucide-react';
import { useState } from 'react';

// ==================== JOIN SALES PAGE ====================
export const JoinSales = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Join Our Sales Team</h1>
        <p className="text-xl text-blue-100">Become a partner and grow with us</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-bold mb-4">Sales Partnership Opportunities</h2>
        <p className="text-gray-600 mb-6">We are looking for motivated professionals to join our sales team.</p>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">Apply Now</button>
      </div>
    </div>
  </div>
);

// ==================== SUCCESS STORIES PAGE ====================
export const SuccessStories = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Success Stories</h1>
        <p className="text-xl text-blue-100">Learn how businesses succeed with IndianTradeMart</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold mb-2">Success Story {i}</h3>
            <p className="text-gray-600 mb-4">Learn how Company {i} achieved 300% growth using our platform...</p>
            <button className="text-blue-600 hover:text-blue-800 font-semibold">Read Full Story →</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ==================== HELP PAGE ====================
export const Help = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Help Center</h1>
        <p className="text-xl text-blue-100">Find answers to your questions</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['Getting Started', 'Account Management', 'Buying', 'Selling', 'Payments', 'Shipping'].map((topic, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-3">{topic}</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• How to...</li>
              <li>• Best practices</li>
              <li>• FAQ</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ==================== CUSTOMER CARE PAGE ====================
export const CustomerCare = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Customer Care</h1>
        <p className="text-xl text-blue-100">Your satisfaction is our priority. Get in touch with our dedicated customer care team.</p>
      </div>
    </div>

    <main className="container mx-auto px-4 py-12">
      <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-4">
              <Phone className="text-blue-600 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Call us</h3>
                <p className="text-gray-700">+91 7290010051</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-4">
              <Mail className="text-blue-600 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Email us</h3>
                <p className="text-gray-700">support@indiantrademart.com</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-4">
              <MapPin className="text-blue-600 mt-1 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Visit us</h3>
                <p className="text-gray-700">672, White House, Behind- MCD School, MG Road, Ghitorni, New Delhi, Delhi 110030</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">FAQs</h2>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="space-y-6">
            {['How do I create an account?', 'How do I place an order?', 'What is your return policy?', 'How long does delivery take?'].map((faq, i) => (
              <div key={i} className="border-b pb-4 last:border-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq}</h3>
                <p className="text-gray-600">Find detailed answers to this question in our knowledge base.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Support Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Submit a Ticket</h3>
            <p className="text-gray-600 mb-4">Get in touch with our support team for detailed assistance.</p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Submit Ticket</button>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Live Chat</h3>
            <p className="text-gray-600 mb-4">Chat with our support representatives in real-time.</p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Start Chat</button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Give Us Feedback</h2>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <p className="text-gray-600 mb-6">We value your feedback. Let us know how we can improve our services.</p>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">Share Feedback</button>
        </div>
      </section>
    </main>
  </div>
);

// ==================== COMPLAINTS PAGE ====================
export const Complaints = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Complaints & Grievances</h1>
        <p className="text-xl text-blue-100">Your satisfaction is our priority</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">File a Complaint</h2>
        <p className="text-gray-600 mb-6">We take complaints seriously. Let us know how we can improve.</p>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">File Complaint</button>
      </div>
    </div>
  </div>
);

// ==================== JOBS PAGE ====================
export const Jobs = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Jobs & Careers</h1>
        <p className="text-xl text-blue-100">Join our growing team</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['Software Engineer', 'Sales Manager', 'Business Analyst', 'Marketing Executive'].map((job, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-2">{job}</h3>
            <p className="text-gray-600 mb-4">Location: India</p>
            <button className="text-blue-600 hover:text-blue-800 font-semibold">Apply Now →</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ==================== CONTACT PAGE ====================
export const ContactPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3">Contact Us</h1>
          <p className="text-xl text-blue-100">We'd love to hear from you. Get in touch with our team anytime.</p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Get in Touch</h2>
          
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Contact Information</h3>
              <p className="text-gray-700 mb-8">
                Have questions or need assistance? We're here to help! Reach out to us through any of the following channels:
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <Mail className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-gray-900">Email Support</h4>
                    <p className="text-gray-700">support@indiantrademart.com</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <Phone className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-gray-900">Phone Support</h4>
                    <p className="text-gray-700">+91 7290010051</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <MapPin className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-gray-900">Office Address</h4>
                    <p className="text-gray-700">
                      Indian Trade Mart Pvt. Ltd.<br />
                      672, White House, Behind- MCD School, MG Road<br/>
                       Ghitorni, New Delhi, Delhi 110030
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <Clock className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-gray-900">Business Hours</h4>
                    <p className="text-gray-700">
                      Monday - Friday: 9:00 AM - 6:00 PM<br />
                      Saturday: 10:00 AM - 4:00 PM<br />
                      Sunday: Closed
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Department Contacts</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">General Information:</span>
                    <span className="text-gray-900">info@indiantrademart.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Customer Care:</span>
                    <span className="text-gray-900">customercare@indiantrademart.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Business Development:</span>
                    <span className="text-gray-900">bd@indiantrademart.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">HR Department:</span>
                    <span className="text-gray-900">hr@indiantrademart.com</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Send us a Message</h3>
              
              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">{successMessage}</p>
                </div>
              )}
              
              {errorMessage && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">{errorMessage}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Your first name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Your last name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="+91 7290010051"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Subject of your message"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Please describe your inquiry in detail..."
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ==================== BUY LEADS PAGE ====================
export const BuyLeads = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Latest Buy Leads</h1>
        <p className="text-xl text-blue-100">Hot opportunities from verified buyers</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <p className="text-gray-600 mb-6">View real-time buy leads from verified buyers across India.</p>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">Browse Buy Leads</button>
      </div>
    </div>
  </div>
);

// ==================== LEARNING CENTRE PAGE ====================
export const LearningCentre = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Learning Centre</h1>
        <p className="text-xl text-blue-100">Master the skills to succeed</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Getting Started', 'Sales Strategies', 'Digital Marketing'].map((course, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-2">{course}</h3>
            <p className="text-gray-600 mb-4">Learn from industry experts</p>
            <button className="text-blue-600 hover:text-blue-800 font-semibold">Enroll Now →</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ==================== PRODUCTS YOU BUY PAGE ====================
export const ProductsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');

  const products = [
    {
      id: 1,
      name: "Industrial Steel Pipes",
      category: "Steel & Metal",
      description: "High-quality industrial grade steel pipes for construction and manufacturing",
      price: "₹85/kg",
      minOrder: "500 kg",
      supplier: "MetalCorp Industries",
      location: "Mumbai, Maharashtra",
      rating: 4.8,
      reviews: 245,
      verified: true,
      features: ["IS 3589 Certified", "Multiple Sizes", "Bulk Orders", "Fast Delivery"],
      inStock: true
    },
    {
      id: 2,
      name: "Organic Cotton Fabric",
      category: "Textiles",
      description: "Premium organic cotton fabric for garment manufacturing",
      price: "₹180/meter",
      minOrder: "1000 meters",
      supplier: "EcoTextiles Ltd",
      location: "Bangalore, Karnataka",
      rating: 4.9,
      reviews: 189,
      verified: true,
      features: ["GOTS Certified", "Sustainable", "Various Colors", "Premium Quality"],
      inStock: true
    },
    {
      id: 3,
      name: "LED Components Kit",
      category: "Electronics",
      description: "Complete LED components kit for lighting manufacturers",
      price: "₹45/piece",
      minOrder: "5000 pieces",
      supplier: "TechLED Solutions",
      location: "Pune, Maharashtra",
      rating: 4.7,
      reviews: 156,
      verified: true,
      features: ["High Efficiency", "Long Lifespan", "Multiple Variants", "Technical Support"],
      inStock: true
    },
    {
      id: 4,
      name: "Food Grade Packaging",
      category: "Packaging",
      description: "FDA approved food grade packaging materials",
      price: "₹12/unit",
      minOrder: "10000 units",
      supplier: "SafePack Industries",
      location: "Delhi, NCR",
      rating: 4.6,
      reviews: 298,
      verified: true,
      features: ["FDA Approved", "Eco-Friendly", "Custom Sizes", "Bulk Pricing"],
      inStock: true
    },
    {
      id: 5,
      name: "Pharmaceutical Raw Materials",
      category: "Pharmaceuticals",
      description: "High purity pharmaceutical raw materials and APIs",
      price: "₹2,500/kg",
      minOrder: "25 kg",
      supplier: "PharmaChem Corp",
      location: "Hyderabad, Telangana",
      rating: 4.9,
      reviews: 134,
      verified: true,
      features: ["WHO GMP", "COA Provided", "High Purity", "Regulatory Compliance"],
      inStock: true
    },
    {
      id: 6,
      name: "Solar Panel Components",
      category: "Solar Equipment",
      description: "Complete solar panel components for renewable energy projects",
      price: "₹25/watt",
      minOrder: "1000 watts",
      supplier: "SolarTech Energy",
      location: "Jaipur, Rajasthan",
      rating: 4.8,
      reviews: 167,
      verified: true,
      features: ["High Efficiency", "25 Year Warranty", "Certified", "Installation Support"],
      inStock: true
    },
    {
      id: 7,
      name: "Industrial Machinery Parts",
      category: "Machinery",
      description: "Precision engineered industrial machinery parts and components",
      price: "₹1,200/piece",
      minOrder: "100 pieces",
      supplier: "MechParts Industries",
      location: "Chennai, Tamil Nadu",
      rating: 4.7,
      reviews: 203,
      verified: true,
      features: ["Precision Made", "Durable", "Custom Orders", "Technical Support"],
      inStock: false
    },
    {
      id: 8,
      name: "Chemical Compounds",
      category: "Chemicals",
      description: "Industrial grade chemical compounds for manufacturing",
      price: "₹350/kg",
      minOrder: "500 kg",
      supplier: "ChemCore Solutions",
      location: "Vadodara, Gujarat",
      rating: 4.5,
      reviews: 178,
      verified: true,
      features: ["High Purity", "Safety Certified", "Bulk Supply", "Technical Data"],
      inStock: true
    },
    {
      id: 9,
      name: "Agricultural Equipment",
      category: "Agriculture",
      description: "Modern agricultural equipment and farming tools",
      price: "₹15,000/unit",
      minOrder: "10 units",
      supplier: "AgriTech Solutions",
      location: "Ludhiana, Punjab",
      rating: 4.6,
      reviews: 89,
      verified: true,
      features: ["Modern Design", "Efficient", "Warranty", "Training Support"],
      inStock: true
    }
  ];

  const categories = [
    "All Categories", "Steel & Metal", "Textiles", "Electronics", "Packaging",
    "Pharmaceuticals", "Solar Equipment", "Machinery", "Chemicals", "Agriculture"
  ];

  const locations = [
    "All Locations", "Mumbai", "Delhi", "Bangalore", "Pune", "Chennai",
    "Hyderabad", "Jaipur", "Vadodara", "Ludhiana"
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || product.category === selectedCategory;
    const matchesLocation = selectedLocation === 'All Locations' || product.location.includes(selectedLocation);
    return matchesSearch && matchesCategory && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3">Products You Buy</h1>
          <p className="text-xl text-blue-100">Discover quality products from verified suppliers across India for your business needs</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products, suppliers, categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select 
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
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
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative">
                <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-center">
                    <ShoppingCart size={32} className="mx-auto mb-2" />
                    <div className="text-sm font-medium">{product.category}</div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50">
                    <Heart size={16} className="text-gray-600" />
                  </button>
                  <button className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50">
                    <Eye size={16} className="text-gray-600" />
                  </button>
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

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{product.description}</p>

                <div className="flex items-center mb-3">
                  <Star className="text-yellow-500 mr-1" size={14} />
                  <span className="text-sm font-medium">{product.rating}</span>
                  <span className="text-gray-500 text-sm ml-1">({product.reviews})</span>
                </div>

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

                <div className="flex gap-2">
                  <button 
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      product.inStock 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!product.inStock}
                  >
                    {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                  <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    Quote
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No products found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
};
