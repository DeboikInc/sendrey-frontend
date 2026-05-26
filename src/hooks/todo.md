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

A senior dev who could handle this codebase would cost you 300k minimum, I'm asking for 200k.
I'm looking at 200k based on the scope of what I've built and what it would cost to replace.

before we go live we need to upgrade these three services.
Upgrade Render to paid plan
Sort Cloudinary paid plan
MongoDB Atlas — make sure it's not on free tier either (512MB storage limit)

"runner misconduct costs us X in Paystack fees per ban, do we absorb or pass to user?

Now issue is dispute reasons showing, some are showing while others arent