# hotfix — work directly on dev, test it, push up the chain

git checkout dev
# fix the bug
git add .
git commit -m "fix: phone validation bug"

# works? push to staging
git checkout staging
git merge dev

# tested on staging? push to main
git checkout main
git merge staging

https://sendrey.netlify.app


- add browser notifications

- phone delivery to run errand

presenceHeartbeat — same, lossy by design, fine.

add runner to know reason for rejection

landing page merge

sendreyerrand@gmail.com

ledger is not showing for completed run errand in runner wallet

mark as delivered issue
ledger is not showing for card payment still

Real-time socket connections
Complex state machines for orders
Geolocation and live tracking
Escrow and payment flows
KYC verification
Role-based flows for runners and users

A senior dev who could handle this codebase would cost you 300k minimum, I'm asking for 150k.

before we go live we need to upgrade these three services.
Upgrade Render to paid plan
Sort Cloudinary paid plan
MongoDB Atlas — make sure it's not on free tier either (512MB storage limit)