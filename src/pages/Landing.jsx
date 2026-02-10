import React, { useState } from 'react';
import { Mail, User, Briefcase } from 'lucide-react';
import { Button } from "@material-tailwind/react";
import Logo from "../assets/Sendrey-Logo-Variants-09.png";

// Import components
import Nav from '../components/landing/Nav';
import Hero from '../components/landing/Hero';
import WhyChooseUs from '../components/landing/WhyChooseUs';
import Services from '../components/landing/Services';
import HowItWorks from '../components/landing/HowItWorks';

const Landing = () => {
    const [userEmail, setUserEmail] = useState('');
    const [runnerEmail, setRunnerEmail] = useState('');
    const [userType, setUserType] = useState('individual');
    const [userSubmitted, setUserSubmitted] = useState(false);
    const [runnerSubmitted, setRunnerSubmitted] = useState(false);

    const handleUserWaitlist = (e) => {
        e.preventDefault();
        console.log('User waitlist submission:', { email: userEmail, type: userType });
        setUserSubmitted(true);
        setUserEmail('');
        setTimeout(() => setUserSubmitted(false), 3000);
    };

    const handleRunnerWaitlist = (e) => {
        e.preventDefault();
        console.log('Runner waitlist submission:', runnerEmail);
        setRunnerSubmitted(true);
        setRunnerEmail('');
        setTimeout(() => setRunnerSubmitted(false), 3000);
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <Nav />

            {/* Hero Section */}
            <Hero />

            {/* Why Choose Sendrey Section */}
            {/* <WhyChooseUs /> */}

            {/* Services Section */}
            {/* <Services /> */}

            {/* How It Works Section */}
            {/* <HowItWorks /> */}

            {/* Waitlist Section */}
            <section id="waitlist" className="py-20 bg-gradient-to-r from-[#152C3D] to-[#0f1f2d]">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-4">Join Our Waitlist</h2>
                        <p className="text-xl text-gray-200 max-w-2xl mx-auto">
                            Be among the first to experience Sendrey's premium logistics services
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12">
                        {/* User Waitlist */}
                        <div className="bg-white rounded-2xl p-8 shadow-xl">
                            <div className="w-16 h-16 rounded-full bg-[#F47C20]/10 flex items-center justify-center mb-6">
                                <User className="w-8 h-8 text-[#F47C20]" />
                            </div>
                            <h3 className="text-2xl font-bold text-[#152C3D] mb-4">Join as a User</h3>
                            <p className="text-[#131313] mb-6">
                                Get access to trusted runners for your deliveries, errands, and moving needs.
                                Increase your productivity today!
                            </p>

                            <form onSubmit={handleUserWaitlist} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            className={`flex-1 py-3 px-4 rounded-lg border-2 ${userType === 'individual' ? 'border-[#F47C20] bg-[#F47C20]/10 text-[#F47C20]' : 'border-gray-300 text-gray-600'}`}
                                            onClick={() => setUserType('individual')}
                                        >
                                            Individual
                                        </button>
                                        <button
                                            type="button"
                                            className={`flex-1 py-3 px-4 rounded-lg border-2 ${userType === 'corporate' ? 'border-[#F47C20] bg-[#F47C20]/10 text-[#F47C20]' : 'border-gray-300 text-gray-600'}`}
                                            onClick={() => setUserType('corporate')}
                                        >
                                            Corporate
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="email"
                                            value={userEmail}
                                            onChange={(e) => setUserEmail(e.target.value)}
                                            placeholder="Enter your email address"
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#F47C20] focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-[#F47C20] hover:bg-[#e56b0f] text-white py-3 rounded-lg font-semibold"
                                >
                                    {userSubmitted ? 'Thank you!' : 'Join Waitlist'}
                                </Button>

                                {userSubmitted && (
                                    <p className="text-green-600 text-center">
                                        You're on the list! We'll notify you when we launch.
                                    </p>
                                )}
                            </form>
                        </div>

                        {/* Runner Waitlist */}
                        <div className="bg-white rounded-2xl p-8 shadow-xl">
                            <div className="w-16 h-16 rounded-full bg-[#152C3D]/10 flex items-center justify-center mb-6">
                                <Briefcase className="w-8 h-8 text-[#152C3D]" />
                            </div>
                            <h3 className="text-2xl font-bold text-[#152C3D] mb-4">Become a Runner</h3>
                            <p className="text-[#131313] mb-6">
                                Join our network of trusted runners and earn money on your schedule.
                                Be part of Lagos's most reliable logistics team.
                            </p>

                            <form onSubmit={handleRunnerWaitlist} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="email"
                                            value={runnerEmail}
                                            onChange={(e) => setRunnerEmail(e.target.value)}
                                            placeholder="Enter your email address"
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#152C3D] focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-[#152C3D] hover:bg-[#0f1f2d] text-white py-3 rounded-lg font-semibold"
                                >
                                    {runnerSubmitted ? 'Thank you!' : 'Join Runner Waitlist'}
                                </Button>

                                {runnerSubmitted && (
                                    <p className="text-green-600 text-center">
                                        We'll contact you soon with next steps!
                                    </p>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#131313] text-white py-8">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-4 gap-8 mb-12">
                        <div>
                            <div className="flex justify-start space-x-2 mb-6">
                                <div className="w-full h-10">
                                    <img
                                        src={Logo}
                                        alt="Sendrey Logo"
                                        className="h-10 w-auto"
                                    />
                                </div>
                            </div>
                            <p className="text-gray-400 mb-4">
                                Your trusted productivity ally for seamless logistics in Lagos, Nigeria.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Services</h4>
                            <ul className="space-y-3 text-gray-400">
                                <li><a href="#services" className="hover:text-white transition-colors">Purchasing & Delivery</a></li>
                                <li><a href="#services" className="hover:text-white transition-colors">Personal Errands</a></li>
                                <li><a href="#services" className="hover:text-white transition-colors">Corporate Services</a></li>
                                <li><a href="#services" className="hover:text-white transition-colors">Goods Moving</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Company</h4>
                            <ul className="space-y-3 text-gray-400">
                                {/* <li><a href="#why-choose" className="hover:text-white transition-colors">Why Choose Us</a></li> */}
                                {/* <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li> */}
                                <li><a href="#waitlist" className="hover:text-white transition-colors">Join Waitlist</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Contact</h4>
                            <ul className="space-y-3 text-gray-400">
                                <li>support@sendrey.com</li>
                                {/* <li>+234 000 999 7777</li> */}
                                <li>Lagos, Nigeria</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-5 text-center text-gray-400">
                        <p>&copy; {new Date().getFullYear()} Sendrey. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;