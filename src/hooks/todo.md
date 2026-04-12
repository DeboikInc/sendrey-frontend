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

next feature: if runner started registration with pedestrian, meaning they provided only one doc + selfie then start new order and is returning should provide only pedestrian options or maybe none, only serviceType should always be updated, for other users, same. if runner started with van then fleetType must always be van and i think it makes sense not to ask for it in start new order and isReturninguser flow 

i need option for runner to raise dispute
persist user components to survive refresh

now in socket, when user/runner goes offline, i want to notify the other person via notification + system message