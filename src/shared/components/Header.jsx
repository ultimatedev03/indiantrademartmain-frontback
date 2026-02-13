<>
  <Link 
    to="/directory" 
    onClick={onClick}
    className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
  >
    Directory
  </Link>

  <Link 
    to="/directory/search" 
    onClick={onClick}
    className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
  >
    Products
  </Link>

  <Link 
    to="/pricing" 
    onClick={onClick}
    className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
  >
    Pricing
  </Link>

  <a
    href="https://blog.indiantrademart.com"
    target="_blank"
    rel="noopener noreferrer"
    onClick={onClick}
    className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
  >
    Blog
  </a>
</>