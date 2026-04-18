# ── Build stage ───────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy Gradle wrapper and dependency descriptors first for layer caching
COPY gradlew gradlew.bat gradle.properties ./
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./

# Download dependencies (cached unless build files change)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon -q || true

# Copy source and build the JAR
COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/build/libs/api-0.0.1-SNAPSHOT.jar app.jar

# Flyway reads migrations from filesystem:db/migration relative to working dir
COPY db/migration db/migration

EXPOSE 3001

ENTRYPOINT ["java", "-jar", "app.jar"]
