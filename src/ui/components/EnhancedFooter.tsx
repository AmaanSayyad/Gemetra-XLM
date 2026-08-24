"use client";

import React from "react";
import * as SubframeUtils from "../utils";
import { LinkButton } from "./LinkButton";
import { IconButton } from "./IconButton";
import Squares from "../../components/Squares";
import {
  Twitter,
  Github,
  Linkedin,
  Mail,
  Globe,
  Shield,
  Clock,
  DollarSign,
  Bot,
  ExternalLink,
} from "lucide-react";
import { GEMETRA_LINKS } from "../../config/links";

interface EnhancedFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const EnhancedFooter = React.forwardRef<HTMLElement, EnhancedFooterProps>(
  function EnhancedFooter(
    { className, ...otherProps }: EnhancedFooterProps,
    ref
  ) {
    return (
      <footer
        className={SubframeUtils.twClassNames(
          "w-full bg-white border-t border-neutral-200 text-neutral-900 relative overflow-hidden",
          className
        )}
        ref={ref as any}
        {...otherProps}
      >
        {/* Squares Background */}
        <Squares
          speed={0.5}
          squareSize={40}
          direction='diagonal'
          borderColor="#f1f1f1"
          hoverFillColor="#F1F1F1"
        />

        {/* Animated Gradient Overlay */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-brand-50/10 to-transparent animate-pulse-slow z-0"></div>

        <div className="relative z-10">
          {/* Main Footer Content */}
          <div className="max-w-[1280px] mx-auto px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Company Info */}
              <div className="col-span-1 md:col-span-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⚡</span>
                  <span className="font-['Montserrat'] text-xl font-[800] text-neutral-900">Gemetra</span>
                </div>

                <p className="text-neutral-600 mb-4 text-sm leading-relaxed">
                  Borderless payments infrastructure built on Stellar with XLM for fast, low-cost global transactions.
                </p>

                {/* Social Links */}
                <div className="flex items-center gap-2 mb-4">
                  <a
                    href={GEMETRA_LINKS.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-neutral-100 hover:bg-purple-100 transition-all duration-300 flex items-center justify-center group"
                  >
                    <Twitter size={16} className="text-neutral-600 group-hover:text-purple-600 transition-colors" />
                  </a>
                  <a
                    href={GEMETRA_LINKS.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-neutral-100 hover:bg-purple-100 transition-all duration-300 flex items-center justify-center group"
                  >
                    <Github size={16} className="text-neutral-600 group-hover:text-purple-600 transition-colors" />
                  </a>
                  <a
                    href="https://linkedin.com/company/gemetra"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-neutral-100 hover:bg-purple-100 transition-all duration-300 flex items-center justify-center group"
                  >
                    <Linkedin size={16} className="text-neutral-600 group-hover:text-purple-600 transition-colors" />
                  </a>
                </div>

                {/* Security Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                  <Shield size={14} className="text-green-600" />
                  <span className="text-green-700 text-xs font-medium">Enterprise-grade security</span>
                </div>
              </div>

              {/* Links Sections */}
              <div className="col-span-1 md:col-span-2">
                <h4 className="font-['Montserrat'] text-sm font-[700] mb-4 text-neutral-900">
                  Solutions
                </h4>
                <div className="flex flex-col gap-2">
                  <a href="#vat-refunds" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    VAT Refunds
                  </a>
                  <a href="#enterprise" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Enterprise
                  </a>
                  <a href="#compliance" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Compliance
                  </a>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <h4 className="font-['Montserrat'] text-sm font-[700] mb-4 text-neutral-900">
                  Company
                </h4>
                <div className="flex flex-col gap-2">
                  <a href="#about" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    About
                  </a>
                  <a href="#careers" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Careers
                  </a>
                  <a href="#blog" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Blog
                  </a>
                  <a href="#press" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Press
                  </a>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <h4 className="font-['Montserrat'] text-sm font-[700] mb-4 text-neutral-900">
                  Resources
                </h4>
                <div className="flex flex-col gap-2">
                  <a href={GEMETRA_LINKS.demo} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm flex items-center gap-1">
                    <span>Demo Video</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href={GEMETRA_LINKS.deck} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm flex items-center gap-1">
                    <span>Pitch Deck</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href={GEMETRA_LINKS.github} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm flex items-center gap-1">
                    <span>GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href={GEMETRA_LINKS.x} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm flex items-center gap-1">
                    <span>X (@GemetraClaims)</span>
                    <ExternalLink size={12} />
                  </a>
                  <a href="#api" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    API Reference
                  </a>
                  <a href="#help" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Help Center
                  </a>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <h4 className="font-['Montserrat'] text-sm font-[700] mb-4 text-neutral-900">
                  Contact
                </h4>
                <div className="flex flex-col gap-3">
                  <a
                    href="mailto:amaansayyad2001@gmail.com"
                    className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <Mail size={14} />
                    <span className="text-sm">amaansayyad2001@gmail.com</span>
                  </a>
                  <a
                    href={GEMETRA_LINKS.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <Globe size={14} />
                    <span className="text-sm">Gemetra App</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Features Highlight */}
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-purple-600" />
                  <span className="text-neutral-700 text-xs font-medium">4-Second Finality</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-green-600" />
                  <span className="text-neutral-700 text-xs font-medium">Ultra-Low Fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-blue-600" />
                  <span className="text-neutral-700 text-xs font-medium">AI-Driven</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-orange-600" />
                  <span className="text-neutral-700 text-xs font-medium">190+ Countries</span>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="mt-6 pt-6 border-t border-neutral-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col md:flex-row items-center gap-4 text-sm">
                <span className="text-neutral-600">© {new Date().getFullYear()} Gemetra. All rights reserved.</span>
                <div className="flex gap-4">
                  <a href="#privacy" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Privacy Policy
                  </a>
                  <a href="#terms" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Terms of Service
                  </a>
                  <a href="#cookies" className="text-neutral-600 hover:text-neutral-900 transition-colors text-sm">
                    Cookies
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 text-sm">Powered by</span>
                <img
                  src="/xlm.png"
                  alt="XLM logo"
                  className="h-4 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }
);

export default EnhancedFooter;
