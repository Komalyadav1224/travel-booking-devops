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
        IMAGE = 'travel-booking'
        TAG   = "${env.BUILD_NUMBER}"
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
                    // Does not fail the build if Trivy is not installed on this Jenkins
                    try {
                        run("trivy image --severity CRITICAL --exit-code 1 ${IMAGE}:${TAG}")
                    } catch (err) {
                        echo "Trivy step failed or Trivy is not installed: ${err}"
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