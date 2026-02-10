import React from 'react';
import { Package, MapPin, Briefcase, ShoppingBag, ChevronRight } from 'lucide-react';

const Services = () => {
    const services = [
        {
            icon: <Package className="w-10 h-10" />,
            title: "Purchasing & Delivery",
            description: "Get anything purchased and delivered from anywhere in the city.",
            color: "bg-[#F47C20]/10"
        },
        {
            icon: <MapPin className="w-10 h-10" />,
            title: "Personal Errands",
            description: "Run your personal errands with our trusted network of runners.",
            color: "bg-[#152C3D]/10"
        },
        {
            icon: <Briefcase className="w-10 h-10" />,
            title: "Corporate Services",
            description: "Business solutions for bulk deliveries and logistics management.",
            color: "bg-[#F47C20]/10"
        },
        {
            icon: <ShoppingBag className="w-10 h-10" />,
            title: "Goods Moving",
            description: "Moving goods of varied sizes with care and efficiency.",
            color: "bg-[#152C3D]/10"
        }
    ];

    return (
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
    );
};

export default Services;