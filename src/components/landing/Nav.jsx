import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from "@material-tailwind/react";
import Logo from "../../assets/Sendrey-Logo-Variants-09.png";

const Nav = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-lg py-3' : 'bg-transparent py-5'}`}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-full h-10 flex items-center justify-center">
                            <img
                                src={Logo}
                                alt="Sendrey Logo"
                                className="h-10 w-auto"
                            />
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {/* <a href="#why-choose" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Why Choose Us</a> */}
                        {/* <a href="#services" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Services</a> */}
                        {/* <a href="#how-it-works" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">How It Works</a> */}
                        <a href="#waitlist" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Join Waitlist</a>
                        {/* <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-6 py-3 rounded-lg font-semibold">
                            Get Started
                        </Button> */}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden text-[#152C3D]"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg py-4 px-4">
                        <div className="flex flex-col space-y-4">
                            {/* <a href="#why-choose" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Why Choose Us</a> */}
                            {/* <a href="#services" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Services</a> */}
                            {/* <a href="#how-it-works" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">How It Works</a> */}
                            <a href="#waitlist" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Join Waitlist</a>
                            {/* <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white w-full py-3 rounded-lg font-semibold">
                                Get Started
                            </Button> */}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Nav;