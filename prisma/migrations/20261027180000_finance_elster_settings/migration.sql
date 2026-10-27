-- Мандатные признаки для ELSTER/Anlage EÜR (пункты 6.2 карты ELSTER_MAPPING.md).
-- Миграция аддитивная и идемпотентная: ADD COLUMN IF NOT EXISTS можно запускать повторно,
-- а перенос §19-статуса из smallBusiness выполняется только при первом появлении колонки,
-- чтобы повторный прогон не включал флаг обратно после осознанного отключения.

DO $$
DECLARE
    had_column BOOLEAN;
BEGIN
    had_column := EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'financesettings' AND column_name = 'kleinunternehmer'
    );

    -- Kleinunternehmer (§19 UStG): EÜR brutto, USt 0, без Vorsteuerabzug
    ALTER TABLE "financesettings" ADD COLUMN IF NOT EXISTS "kleinunternehmer" BOOLEAN NOT NULL DEFAULT false;
    -- Soll-/Ist-Versteuerung: при IST заполняется Zahlungsdatum, при SOLL — нет
    ALTER TABLE "financesettings" ADD COLUMN IF NOT EXISTS "sollIst" TEXT NOT NULL DEFAULT 'SOLL';
    -- Wirtschaftsjahr (для EÜR, может отличаться от календарного года); по умолчанию — текущий год
    ALTER TABLE "financesettings" ADD COLUMN IF NOT EXISTS "wirtschaftsjahr" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int;

    -- Существующие фирмы уже вели §19-статус как smallBusiness (документы без USt) — переносим его
    -- в налоговый флаг, иначе первая выгрузка EÜR посчитала бы расходы нетто.
    IF NOT had_column THEN
        UPDATE "financesettings" SET "kleinunternehmer" = "smallBusiness";
    END IF;
END $$;
