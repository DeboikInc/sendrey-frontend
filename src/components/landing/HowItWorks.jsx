import React, { useState } from 'react';
import {
    Target,
    MapPin,
    Users,
    Package,
    User,
    FileCheck,
    DollarSign,
    Download
} from 'lucide-react';
import { Button } from "@material-tailwind/react";
import apple from "../../assets/apple.png";
import googleplay from "../../assets/googleplay.png";

const HowItWorks = () => {
    const [activeTab, setActiveTab] = useState('users');

    const userSteps = [
        {
            icon: <Target className="w-10 h-10" />,
            number: "02",
            title: "Choose Service",
            description: "Select pickup, delivery, or errand service"
        },
        {
            icon: <MapPin className="w-10 h-10" />,
            number: "03",
            title: "Set Details",
            description: "Specify pickup/drop-off locations and items"
        },
        {
            icon: <Users className="w-10 h-10" />,
            number: "04",
            title: "Get Matched",
            description: "Connect with a verified runner in your area"
        },
        {
            icon: <Package className="w-10 h-10" />,
            number: "05",
            title: "Track & Receive",
            description: "Track in real-time and receive confirmation"
        }
    ];

    const runnerSteps = [
        {
            icon: <User className="w-10 h-10" />,
            number: "02",
            title: "Register as Runner",
            description: "Create your runner profile with basic details"
        },
        {
            icon: <FileCheck className="w-10 h-10" />,
            number: "03",
            title: "Complete KYC",
            description: "Verify your identity through our secure process"
        },
        {
            icon: <DollarSign className="w-10 h-10" />,
            number: "04",
            title: "Start Earning",
            description: "Accept delivery requests and start making money"
        }
    ];

    // Common download card component
    const DownloadCard = ({ isForRunners = false }) => {
        const primaryColor = isForRunners ? "#152C3D" : "#F47C20";
        const bgColor = isForRunners ? "bg-[#152C3D]/10" : "bg-[#F47C20]/10";
        
        return (
            <div className="mb-12">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center mb-6`}>
                            <Download className="w-10 h-10" style={{ color: primaryColor }} />
                        </div>
                        <div className="text-3xl font-bold mb-2" style={{ color: primaryColor }}>01</div>
                        <h3 className="text-2xl font-bold text-[#152C3D] mb-4">Download Our App</h3>
                        <p className="text-[#131313] text-lg mb-8">
                            Get the Sendrey app from the App Store or Google Play Store
                        </p>

                        {/* App Store Buttons */}
                        {/* <div className="flex flex-wrap gap-4 justify-center mb-3"> */}
                            {/* Apple Store Button */}
                            {/* <button className="flex justify-center items-center cursor-not-allowed bg-primary/100 rounded-xl px-2 py-1  gap-1 transition-colors">
                                <img
                                    src={apple}
                                    alt="Download on the App Store"
                                    className="h-10"
                                />
                                <div className='flex flex-col items-start text-gray-200'>
                                    <p className='text-xs'>Download on the</p>
                                    <p className='text-xl font-bold'>Apple Store</p>
                                </div>
                            </button> */}

                            {/* Google Play Button */}
                            {/* <button className="flex justify-center items-center cursor-not-allowed bg-secondary rounded-xl px-2 py-1 gap-1 transition-colors">
                                <img
                                    src={googleplay}
                                    alt="Get it on Google Play"
                                    className="h-10 w-auto"
                                />
                                <div className='flex flex-col items-start text-gray-200'>
                                    <p className='text-sm'>Get it on</p>
                                    <p className='text-lg font-bold'>Google Play</p>
                                </div>
                            </button> */}
                        {/* </div> */}
                        
                        {/* Coming Soon text below buttons */}
                    </div>
                        <p className="text-gray-700 flex justify-center font-medium text-sm mt-2">Coming Soon</p>
                </div>
            </div>
        );
    };

    return (
        <section id="how-it-works" className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-[#152C3D] mb-4">How It Works</h2>
                    <p className="text-xl text-[#131313] max-w-2xl mx-auto mb-8">
                        Simple steps to get started with Sendrey
                    </p>

                    {/* Tabs */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex rounded-lg border border-gray-300 p-1">
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-8 py-3 rounded-lg font-semibold transition-all ${activeTab === 'users'
                                    ? 'bg-[#F47C20] text-white'
                                    : 'text-[#152C3D] hover:text-[#F47C20]'
                                    }`}
                            >
                                For Users
                            </button>
                            <button
                                onClick={() => setActiveTab('runners')}
                                className={`px-8 py-3 rounded-lg font-semibold transition-all ${activeTab === 'runners'
                                    ? 'bg-[#152C3D] text-white'
                                    : 'text-[#152C3D] hover:text-[#F47C20]'
                                    }`}
                            >
                                For Runners
                            </button>
                        </div>
                    </div>
                </div>

                {/* Show download card for active tab */}
                {activeTab === 'users' && <DownloadCard isForRunners={false} />}
                {activeTab === 'runners' && <DownloadCard isForRunners={true} />}

                {/* User Steps */}
                {activeTab === 'users' && (
                    <div className="grid md:grid-cols-4 gap-8">
                        {userSteps.map((step, index) => (
                            <div key={index} className="relative">
                                <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
                                    <div className="w-16 h-16 rounded-full bg-[#F47C20]/10 flex items-center justify-center mb-6">
                                        <div className="text-[#F47C20]">
                                            {step.icon}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-[#F47C20] mb-4">{step.number}</div>
                                    <h3 className="text-xl font-bold text-[#152C3D] mb-3">{step.title}</h3>
                                    <p className="text-[#131313]">{step.description}</p>
                                </div>
                                {index < userSteps.length - 1 && (
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-[#F47C20]"></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Runner Steps */}
                {activeTab === 'runners' && (
                    <div className="grid md:grid-cols-3 gap-8">
                        {runnerSteps.map((step, index) => (
                            <div key={index} className="relative">
                                <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
                                    <div className="w-16 h-16 rounded-full bg-[#152C3D]/10 flex items-center justify-center mb-6">
                                        <div className="text-[#152C3D]">
                                            {step.icon}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-[#152C3D] mb-4">{step.number}</div>
                                    <h3 className="text-xl font-bold text-[#152C3D] mb-3">{step.title}</h3>
                                    <p className="text-[#131313]">{step.description}</p>
                                </div>
                                {index < runnerSteps.length - 1 && (
                                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-[#152C3D]"></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* CTA for Both */}
                <div className="text-center mt-12">
                    {activeTab === 'users' ? (
                        <a href="#waitlist">
                            <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-8 py-4 rounded-lg font-semibold text-lg">
                                Join User Waitlist
                            </Button>
                        </a>
                    ) : (
                        <a href="#waitlist">
                            <Button className="bg-[#152C3D] hover:bg-[#0f1f2d] text-white px-8 py-4 rounded-lg font-semibold text-lg">
                                Join Runner Waitlist
                            </Button>
                        </a>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;