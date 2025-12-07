# 🧩 Todo-Nakama

A simple **Todo application** integrated with **Nakama server** using **Go (for backend logic)** and **React (for frontend)**.  
The project demonstrates real-time communication and synchronization using Nakama’s multiplayer and storage APIs.

---

# Public URL

http://54.90.229.73:5173/ (removed now.)

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone [repo]
cd Todo-Nakama
docker compose up
or

cd k8s
# create a k8s cluster by kind or minikube
1. kubectl apply -f namespace.yaml
2. kubectl apply -f .
Note: if any change happen on fe , please delete old build and build it again. then docker compose up.

