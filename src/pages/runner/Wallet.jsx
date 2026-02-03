import { ChevronLeft } from "lucide-react";

export const Wallet = ({darkMode, onBack}) => {
    const dark = darkMode;

    return (

        <>
            <div className={`min-h-screen flex flex-col py-4 bg-white dark:bg-black-100 ${dark ? "dark" : ""}`}>
                <div className="flex border-grey-100 border-b p-2 w-full">
                    <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300"><ChevronLeft /></div>
                    <h1 className="text-xl mr-auto ml-auto text-black-200 dark:text-gray-300">Wallet</h1>
                </div>
                <div className="flex flex-col justify-center items-center px-4">
                    <div className="w-full max-w-md flex justify-between py-4">
                        <p className="text-blue-300">Wallet Balance</p>
                        <p className="dark:text-white">₦0</p>
                    </div>

                    <div className="w-full max-w-md flex flex-col space-y-4">
                        <p className="font-medium py-5 dark:text-white">To add money to your Sendrey Account, make a bank transfer to the account detail below. Funds reflect Instantly</p>
                        <p className="font-medium dark:text-white">No Account details</p>
                        <div className="dark:text-white">
                            <h3 className="text-lg">Transaction history</h3>
                            <p className="text-sm">You have no Transaction History</p>
                        </div>
                    </div>

                </div>
            </div>
        </>
    )
}