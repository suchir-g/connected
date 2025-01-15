import React from "react";

const Footer = () => {
  return (
    <footer className="bg-dark text-white py-5">
      <div className="container text-center">
        <h3 className="mb-4">Synapse Education</h3>
        <nav className="mb-3">
          <a href="#home" className="px-3 text-white">
            Home
          </a>
          <a href="#about" className="px-3 text-white">
            About
          </a>
          <a href="#services" className="px-3 text-white">
            Services
          </a>
          <a href="#contact" className="px-3 text-white">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
};
export default Footer;
