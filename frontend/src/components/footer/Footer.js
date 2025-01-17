import React from "react";

const Footer = () => {
  return (
    <footer className="text-white py-5">
      <hr></hr>
      <div className="container text-center">
        <h3 className="mb-4">Connected</h3>
        <nav className="mb-3">
          <a href="/" className="px-3 text-white">
            Home
          </a>
          <a href="/about" className="px-3 text-white">
            About
          </a>
          <a href="/stats" className="px-3 text-white">
            Services
          </a>
          <a href="/contact" className="px-3 text-white">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
};
export default Footer;
