import React, { useState, useEffect } from 'react';
import {
    ArrowRight,
    CheckCircle,
    Users,
    Shield,
    Clock,
    MapPin,
    ChevronRight,
    Star,
    Menu,
    X,
    Smartphone,
    ShoppingBag,
    Headphones,
    Package
} from 'lucide-react';
import { Button } from "@material-tailwind/react";
import Logo from "../assets/Sendrey-Logo-Variants-09.png"


const Landing = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: <Clock className="w-8 h-8" />,
            title: "Real-time Tracking",
            description: "Track your errands and deliveries in real-time from pickup to drop-off."
        },
        {
            icon: <Shield className="w-8 h-8" />,
            title: "Verified Runners",
            description: "All our runners undergo thorough background checks and verification."
        },
        {
            icon: <Smartphone className="w-8 h-8" />,
            title: "Easy Payments",
            description: "Multiple payment options including cards, mobile money, and cash."
        },
        {
            icon: <Headphones className="w-8 h-8" />,
            title: "24/7 Support",
            description: "Round-the-clock customer support for all your queries and concerns."
        }
    ];

    const services = [
        {
            icon: <Package className="w-10 h-10" />,
            title: "Pick Up & Delivery",
            description: "Get anything delivered from anywhere in the city within hours.",
            color: "bg-[#F47C20]/10"
        },
        {
            icon: <MapPin className="w-10 h-10" />,
            title: "Personal Errands",
            description: "Run your personal errands with our trusted network of runners.",
            color: "bg-[#152C3D]/10"
        },
        {
            icon: <Users className="w-10 h-10" />,
            title: "Bulk Deliveries",
            description: "Business solutions for bulk deliveries and logistics management.",
            color: "bg-[#F47C20]/10"
        },
        {
            icon: <ShoppingBag className="w-10 h-10" />,
            title: "Market Runs",
            description: "Get your groceries, fresh produce, and market items delivered to your doorstep by trusted runners who understand quality.",
            color: "bg-[#152C3D]/10"
        }
    ];

    const testimonials = [
        {
            name: "Sarah Johnson",
            role: "Small Business Owner",
            content: "Sendrey has transformed how I run my business. My deliveries are always on time!",
            rating: 5,
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
        },
        {
            name: "Michael Chen",
            role: "Busy Professional",
            content: "As someone who works long hours, Sendrey has been a lifesaver for my errands.",
            rating: 5,
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
        },
        {
            name: "Amanda Roberts",
            role: "University Student",
            content: "Affordable, reliable, and super convenient. Best delivery service in town!",
            rating: 4,
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amanda"
        }
    ];

    const steps = [
        {
            number: "01",
            title: "Choose Service",
            description: "Select pickup, delivery, or errand service"
        },
        {
            number: "02",
            title: "Set Details",
            description: "Market Runs, Specify pickup/drop-off locations and items"
        },
        {
            number: "03",
            title: "Get Matched",
            description: "Connect with a verified runner in your area"
        },
        {
            number: "04",
            title: "Track & Receive",
            description: "Track in real-time and receive confirmation"
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-lg py-3' : 'bg-transparent py-5'}`}>
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <div className="w-full h-10  flex items-center justify-center">
                                <img
                                    src={Logo}
                                    alt="Sendrey Logo"
                                    className="h-10 w-auto"
                                />
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Features</a>
                            <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Services</a>
                            <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">How It Works</a>
                            <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium">Testimonials</a>
                            <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-6 py-3 rounded-lg font-semibold">
                                Get Started
                            </Button>
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
                                <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Features</a>
                                <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Services</a>
                                <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">How It Works</a>
                                <a href="/landing" className="text-[#152C3D] hover:text-[#F47C20] transition-colors font-medium py-2">Testimonials</a>
                                <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white w-full py-3 rounded-lg font-semibold">
                                    Get Started
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-white to-gray-50">
                <div className="container mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h1 className="text-5xl md:text-6xl font-bold text-[#152C3D] leading-tight mb-6">
                                Your Trusted Partner for
                                <span className="text-[#F47C20]"> Fast & Reliable</span> Deliveries
                            </h1>
                            <p className="text-xl text-[#131313] mb-8">
                                Connect with verified runners for pickup, delivery, and personal errands.
                                Fast, secure, and affordable service at your fingertips.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2">
                                    Start Delivery <ArrowRight className="w-5 h-5" />
                                </Button>
                                <Button variant="outlined" className="border-2 border-[#152C3D] text-[#152C3D] hover:bg-[#152C3D] hover:text-white px-8 py-4 rounded-lg font-semibold text-lg">
                                    Become a Runner
                                </Button>
                            </div>

                            <div className="mt-12 grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-[#152C3D]">10K+</div>
                                    <div className="text-[#131313]">Happy Customers</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-[#152C3D]">5K+</div>
                                    <div className="text-[#131313]">Verified Runners</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-[#152C3D]">99%</div>
                                    <div className="text-[#131313]">On-time Delivery</div>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="bg-gradient-to-br from-[#F47C20]/20 to-[#152C3D]/20 rounded-3xl p-8">
                                <div className="bg-white rounded-2xl shadow-2xl p-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-4 p-4 bg-[#F47C20]/5 rounded-xl">
                                            <div className="w-12 h-12 rounded-full bg-[#F47C20] flex items-center justify-center">
                                                <Package className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[#152C3D]">Package Delivery</h3>
                                                <p className="text-sm text-[#131313]">30 mins ago • In progress</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-4 p-4 bg-[#152C3D]/5 rounded-xl">
                                            <div className="w-12 h-12 rounded-full bg-[#152C3D] flex items-center justify-center">
                                                <MapPin className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[#152C3D]">Errand Service</h3>
                                                <p className="text-sm text-[#131313]">Completed • 15 mins ago</p>
                                            </div>
                                        </div>

                                        <div className="bg-[#131313] rounded-xl p-4 text-white">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-medium">Runner Enroute</span>
                                                <span className="text-[#F47C20] font-semibold">5 min</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div className="bg-[#F47C20] h-2 rounded-full" style={{ width: '75%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-[#152C3D] mb-4">Why Choose Sendrey</h2>
                        <p className="text-xl text-[#131313] max-w-2xl mx-auto">
                            We combine technology with trusted human network for seamless delivery experiences
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((feature, index) => (
                            <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                                <div className="w-16 h-16 rounded-full bg-[#F47C20]/10 flex items-center justify-center mb-6">
                                    <div className="text-[#F47C20]">
                                        {feature.icon}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-[#152C3D] mb-3">{feature.title}</h3>
                                <p className="text-[#131313]">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-[#152C3D] mb-4">Our Services</h2>
                        <p className="text-xl text-[#131313] max-w-2xl mx-auto">
                            From quick pickups to complex errands, we've got you covered
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {services.map((service, index) => (
                            <div key={index} className="group cursor-pointer">
                                <div className={`${service.color} rounded-2xl p-8 h-full transform group-hover:-translate-y-2 transition-transform duration-300`}>
                                    <div className="text-[#F47C20] mb-6">
                                        {service.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-[#152C3D] mb-3">{service.title}</h3>
                                    <p className="text-[#131313] mb-6">{service.description}</p>
                                    <button className="flex items-center text-[#152C3D] font-semibold group-hover:text-[#F47C20] transition-colors">
                                        Learn More <ChevronRight className="w-4 h-4 ml-1" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-[#152C3D] mb-4">How It Works</h2>
                        <p className="text-xl text-[#131313] max-w-2xl mx-auto">
                            Get started with Sendrey in just four simple steps
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {steps.map((step, index) => (
                            <div key={index} className="relative">
                                <div className="bg-white rounded-2xl p-8 shadow-lg">
                                    <div className="text-3xl font-bold text-[#F47C20] mb-4">{step.number}</div>
                                    <h3 className="text-xl font-bold text-[#152C3D] mb-3">{step.title}</h3>
                                    <p className="text-[#131313]">{step.description}</p>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-[#F47C20]"></div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <Button disabled className="bg-[#152C3D] no-cursor hover:bg-[#0f1f2d] text-white px-8 py-4 rounded-lg font-semibold text-lg">
                            Download App Now
                        </Button>
                        <p className='text-[#131313]'>coming soon </p>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonials" className="py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-[#152C3D] mb-4">What Our Customers Say</h2>
                        <p className="text-xl text-[#131313] max-w-2xl mx-auto">
                            Join thousands of satisfied customers who trust Sendrey
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                                <div className="flex items-center mb-6">
                                    <img
                                        src={testimonial.avatar}
                                        alt={testimonial.name}
                                        className="w-12 h-12 rounded-full mr-4"
                                    />
                                    <div>
                                        <h4 className="font-bold text-[#152C3D]">{testimonial.name}</h4>
                                        <p className="text-sm text-[#131313]">{testimonial.role}</p>
                                    </div>
                                </div>
                                <p className="text-[#131313] mb-4">{testimonial.content}</p>
                                <div className="flex text-[#F47C20]">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 fill-current" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-[#152C3D] to-[#0f1f2d]">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Experience Seamless Deliveries?
                    </h2>
                    <p className="text-xl text-gray-200 mb-10 max-w-2xl mx-auto">
                        Join thousands of users who trust Sendrey for their delivery and errand needs
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-8 py-4 rounded-lg font-semibold text-lg">
                            Get Started Free
                        </Button>
                        <Button variant="outlined" className="border-2 border-white text-white hover:bg-white hover:text-[#152C3D] px-8 py-4 rounded-lg font-semibold text-lg">
                            Contact Sales
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#131313] text-white py-12">
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
                            <p className="text-gray-400">
                                Your trusted partner for fast, reliable, and secure deliveries.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Services</h4>
                            <ul className="space-y-3 text-gray-400">
                                <li><a href="/landing" className="hover:text-white transition-colors">Pickup & Delivery</a></li>
                                <li><a href="/landing" className="hover:text-white transition-colors">Personal Errands</a></li>
                                <li><a href="/landing" className="hover:text-white transition-colors">Business Solutions</a></li>
                                <li><a href="/landing'" className="hover:text-white transition-colors">Market Runs</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Company</h4>
                            <ul className="space-y-3 text-gray-400">
                                <li><a href="/landing" className="hover:text-white transition-colors">About Us</a></li>
                                <li><a href="/landing" className="hover:text-white transition-colors">Blog</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg mb-6">Contact</h4>
                            <ul className="space-y-3 text-gray-400">
                                <li>support@sendrey.com</li>
                                <li>+234 000 999 7777</li>
                                <li>123 Delivery St, Suite 100</li>
                                <li>Lagos, Nigeria</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
                        <p>&copy; {new Date().getFullYear()} Sendrey. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;


// waitlists - users and runner
// 25%