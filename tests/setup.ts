// Тесты не должны зависеть от секретов рабочей машины: JWT и ключ шифрования интеграций
// нужны маршрутам, которые тестируются напрямую (те же значения ставит tests/helpers/http.ts).
// Рабочие значения из .env/.env.local при этом не перетираются — ||=.
process.env.JWT_SECRET ||= "test-secret";
process.env.ENCRYPTION_KEY ||= "test-encryption-key";
