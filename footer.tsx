import React from 'react';
import { Github, Mail, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { href: '/terms', label: 'Terms' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/help', label: 'Help' },
    { href: '/status', label: 'Status' }
  ];

  const socialLinks = [
    { href: 'https://github.com', icon: Github, label: 'GitHub' },
    { href: 'https://twitter.com', icon: Twitter, label: 'Twitter' },
    { href: 'mailto:contact@example.com', icon: Mail, label: 'Email' }
  ];

  return (
    <footer className="space-y-4 text-center">
      <div className="flex justify-center items-center gap-6 flex-wrap">
        {footerLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex justify-center items-center gap-4">
        {socialLinks.map((social) => {
          const Icon = social.icon;
          return (
            <a
              key={social.label}
              href={social.href}
              className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
              aria-label={`Visit our ${social.label}`}
            >
              <Icon className="w-4 h-4" />
            </a>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          © {currentYear} AI Agents Platform. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
