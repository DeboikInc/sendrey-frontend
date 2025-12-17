
import { 
    ChevronLeft, 
    ChevronRight,
    User, 
    CreditCard, 
    Trash2 
 } from "lucide-react";


export const Profile = ({ darkMode, onBack }) => {
    const dark = darkMode;

    return (
        <>
            <div className={`min-h-screen flex flex-col py-4 bg-white dark:bg-black-100 ${dark ? "dark" : ""}`}>
                <div className="flex border-grey-100 border-b p-2 w-full">
                    {/* Replace navigate with onBack */}
                    <div onClick={onBack} className="cursor-pointer text-black dark:text-gray-700"><ChevronLeft /></div>
                    <h1 className="text-xl mr-auto ml-auto text-black dark:text-gray-700">Profile</h1>
                </div>
                
                <div className="text-black dark:text-gray-800 flex flex-col justify-center items-center px-4 p-4">
                    <div className="w-full max-w-md flex justify-between items-center p-4 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 cursor-pointer">
                        <div className="flex items-center ">
                            <p className="mr-2"><User /></p>
                            <span>Edit Profile</span>
                        </div>
                        <ChevronRight />
                    </div>
                    <div className="w-full max-w-md flex justify-between items-center p-4 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 cursor-pointer">
                        <div className="flex items-center">
                            <p className="mr-2"><CreditCard /></p>
                            <span>Payments</span>
                        </div>
                        <ChevronRight />
                    </div>
                    <div className="w-full max-w-md flex justify-between items-center p-4 border border-gray-300 dark:border-gray-700 rounded-lg mb-3 cursor-pointer">
                        <div className="flex items-center">
                            <p className="mr-2 text-red-400"><Trash2  /></p>
                            <span>Delete Account</span>
                        </div>
                        <ChevronRight />
                    </div>
                </div>

                <div className="flex justify-center p-4 dark:text-gray-800 mt-auto">
                    Sendrey
                </div>
            </div>
        </>
    )
}