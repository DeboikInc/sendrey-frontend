import React from 'react';
import { ArrowRight, Shield, Target, Zap, Package, MapPin } from 'lucide-react';
import { Button } from "@material-tailwind/react";

const Hero = () => {
    return (
        <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-white to-gray-50">
            <div className="container mx-auto">
                <div className="gap-12 items-center">
                    <div>
                        <h1 className="text-5xl md:text-6xl font-bold text-[#152C3D] leading-tight mb-6">
                            Your Productivity Ally for
                            <span className="text-[#F47C20]"> Seamless Logistics</span>
                        </h1>
                        <p className="text-xl text-[#131313] mb-8">
                            Connecting individuals and corporations with trusted runners for purchasing,
                            delivering, and moving goods. Embrace digital tools with our niche, high-value services.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a href="#waitlist">
                                <Button className="bg-[#F47C20] hover:bg-[#e56b0f] text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2">
                                    Join As a User <ArrowRight className="w-5 h-5" />
                                </Button>
                            </a>
                            <a href="#waitlist">
                                <Button variant="outlined" className="border-2 border-[#152C3D] text-[#152C3D] hover:bg-[#152C3D] hover:text-white px-8 py-4 rounded-lg font-semibold text-lg">
                                    Become a Runner
                                </Button>
                            </a>
                        </div>

                        <div className="mt-12 grid grid-cols-3 gap-6">
                            <div className="text-center">
                                <Shield className="w-10 h-10 text-[#F47C20] mx-auto mb-3" />
                                <div className="text-2xl font-bold text-[#152C3D]">Secure Service</div>
                                <div className="text-[#131313] text-sm mt-1">Your items are protected</div>
                            </div>
                            <div className="text-center">
                                <Target className="w-10 h-10 text-[#152C3D] mx-auto mb-3" />
                                <div className="text-2xl font-bold text-[#152C3D]">Precise</div>
                                <div className="text-[#131313] text-sm mt-1">Accurate, timely deliveries</div>
                            </div>
                            <div className="text-center">
                                <Zap className="w-10 h-10 text-[#F47C20] mx-auto mb-3" />
                                <div className="text-2xl font-bold text-[#152C3D]">Efficient</div>
                                <div className="text-[#131313] text-sm mt-1">Streamlined logistics process</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;