import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export const OngoingOrders = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const dark = location.state?.darkMode;

    return (
        <>
            <div className={`min-h-screen py-4 bg-white dark:bg-black-100 ${dark ? "dark" : ""}`}>
                <div className="flex border-grey-100 border-b p-2 w-full">
                    <div onClick={() => navigate('/raw')} className="cursor-pointer text-black-200 dark:text-gray-700"><ChevronLeft /></div>
                    <h1 className=" text-xl mr-auto ml-auto text-black-200 dark:text-gray-300">Ongoing Orders</h1>
                </div>
                <div className="flex justify-center items-center text-dark dark:text-white p-2">
                    <p>no orders yet.</p>
                </div>
            </div>
        </>
    )
}