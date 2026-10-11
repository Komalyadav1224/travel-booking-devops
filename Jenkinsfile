// Helper: works on both Windows and Linux Jenkins
def run(String cmd) {
    if (isUnix()) { sh cmd } else { bat cmd }
}

pipeline {
    agent any

    parameters {
        booleanParam(name: 'DEPLOY', defaultValue: false,
                     description: 'Deploy to local Kubernetes (rolling update)')
    }
    environment {
        IMAGE      = 'travel-booking'
        TAG        = "${env.BUILD_NUMBER}"
        KUBECONFIG = 'C:/Users/Komal/.kube/config'
    }

    stages {
        stage('Install') {
            steps { script { run('npm install') } }
        }

        stage('Test') {
            steps { script { run('npm test') } }
        }

        stage('Docker Build') {
            steps { script { run("docker build -t ${IMAGE}:${TAG} .") } }
        }

               stage('Security Scan (Trivy)') {
            steps {
                script {
                    try {
                        run("docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity CRITICAL --exit-code 1 ${IMAGE}:${TAG}")
                    } catch (err) {
                        echo "Trivy found a problem or could not run: ${err}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('Deploy (Rolling)') {
            when { expression { params.DEPLOY } }
            steps {
                script {
                    run("kubectl -n travel-rolling set image deploy/travel-booking app=${IMAGE}:${TAG}")
                    run("kubectl -n travel-rolling rollout status deploy/travel-booking --timeout=180s")
                }
            }
        }
    }

    post {
        success { echo 'Pipeline finished successfully.' }
        failure { echo 'Pipeline failed. Check the stage that is red.' }
    }
}