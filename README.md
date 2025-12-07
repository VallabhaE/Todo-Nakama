# 🧩 Todo-Nakama

A simple **Todo application** integrated with **Nakama server** using **Go (for backend logic)** and **React (for frontend)**.  
The project demonstrates real-time communication and synchronization using Nakama’s multiplayer and storage APIs.

---

# Public URL

http://54.90.229.73:5173/ (removed now.)

---
---

## 🚀 Tech Stack

### **Backend**
- **Language:** Go  
- **Game Server Framework:** Nakama  

### **Frontend**
- **React**

### **DevOps / Infrastructure**
- **Containerization:** Dockerfile  
- **Orchestration:** Docker Compose  
- **Deployment:** Kubernetes (YAML manifests)

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
3. kubectl port-forward service/fe-service -n game 80:80
4. kubectl port-forward service/be-service -n game 7350:7350
Note: if any change happen on fe , please delete old build and build it again. then docker compose up.

