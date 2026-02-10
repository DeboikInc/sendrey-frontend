import React from 'react';
import { Shield, Zap, Target, CheckCircle, Users, Clock } from 'lucide-react';

const WhyChooseUs = () => {
    const brandValues = [
        {
            icon: <Shield className="w-8 h-8" />,
            title: "DEPENDABLE",
            description: "Unshakably reliable, you can trust us with urgent tasks and fragile cargo."
        },
        {
            icon: <Zap className="w-8 h-8" />,
            title: "EMPOWERING",
            description: "We free you to focus on what matters by handling the rest."
        },
        {
            icon: <Target className="w-8 h-8" />,
            title: "HUSTLE-SAVVY",
            description: "We get the city's rhythm and work with it."
        },
        {
            icon: <CheckCircle className="w-8 h-8" />,
            title: "HASSLE-FREE",
            description: "No hidden complexities, just straightforward help."
        },
        {
            icon: <Users className="w-8 h-8" />,
            title: "CONNECTED",
            description: "A network that ties people and opportunities together."
        },
        {
            icon: <Clock className="w-8 h-8" />,
            title: "RELIABLE",
            description: "Rain or Lagos traffic, we deliver on our promises."
        }
    ];

    return (
        <section id="why-choose" className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-[#152C3D] mb-4">Why Choose Sendrey</h2>
                    <p className="text-xl text-[#131313] max-w-2xl mx-auto">
                        We combine technology with trusted human network for seamless delivery experiences
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {brandValues.map((value, index) => (
                        <div key={index} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="w-16 h-16 rounded-full bg-[#F47C20]/10 flex items-center justify-center mb-6">
                                <div className="text-[#F47C20]">
                                    {value.icon}
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-[#152C3D] mb-3">{value.title}</h3>
                            <p className="text-[#131313]">{value.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhyChooseUs;