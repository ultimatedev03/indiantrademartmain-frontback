// Join Sales Page
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

// Success Stories Page
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

// Help Page
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

// Customer Care Page
export const CustomerCare = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Customer Care</h1>
        <p className="text-xl text-blue-100">We're here to help you</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Contact Our Support Team</h2>
        <div className="space-y-4">
          <p><strong>Email:</strong> customercare@indiantrademart.com</p>
          <p><strong>Phone:</strong> +91 XXXX-XXXX-XXX</p>
          <p><strong>Hours:</strong> 9 AM - 6 PM (Mon-Fri)</p>
        </div>
      </div>
    </div>
  </div>
);

// Complaints Page
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

// Jobs Page
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

// Contact Page
export const ContactPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Contact Us</h1>
        <p className="text-xl text-blue-100">Get in touch with our team</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-xl font-bold mb-4">Contact Information</h3>
          <div className="space-y-4">
            <p><strong>Address:</strong> Tech Park, Noida, India</p>
            <p><strong>Email:</strong> info@indiantrademart.com</p>
            <p><strong>Phone:</strong> +91 XXXX-XXXX-XXX</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-xl font-bold mb-4">Send us a Message</h3>
          <form className="space-y-4">
            <input type="text" placeholder="Name" className="w-full px-4 py-2 border rounded-lg" />
            <input type="email" placeholder="Email" className="w-full px-4 py-2 border rounded-lg" />
            <textarea placeholder="Message" rows="4" className="w-full px-4 py-2 border rounded-lg"></textarea>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 w-full">Send</button>
          </form>
        </div>
      </div>
    </div>
  </div>
);

// BuyLeads Page
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

// Learning Centre Page
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

// Products Page
export const ProductsPage = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-3">Products You Buy</h1>
        <p className="text-xl text-blue-100">Browse verified products from trusted suppliers</p>
      </div>
    </div>
    <div className="container mx-auto px-4 py-16">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <p className="text-gray-600 mb-6">Explore a wide range of quality products from verified suppliers.</p>
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">Browse Products</button>
      </div>
    </div>
  </div>
);
