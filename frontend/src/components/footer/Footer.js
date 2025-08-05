import React from "react";
// yabadabadoo
const Footer = () => {
  return (
    <footer className="text-white py-5">
      <hr></hr>
      <div className="container text-center">
        <h3 className="mb-4">Connected</h3>
        <nav className="mb-3">
          <a href="/" className="px-3 text-secondary">
            Home
          </a>
          <a href="/register" className="px-3 text-secondary">
            Register
          </a>
          <a href="https://synapse.education/" className="px-3 text-secondary">
            Login
          </a>
          <a href="https://github.com/suchir-g" className="px-3 text-secondary">
            My Github
          </a>
        </nav>
      </div>
    </footer>
  );
};
export default Footer;
