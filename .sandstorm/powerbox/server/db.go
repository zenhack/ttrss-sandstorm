package main

import (
	"database/sql"
)

type Storage struct {
	db *sql.DB
}

func NewStorage(db *sql.DB) (Storage, error) {
	s := Storage{db: db}
	return s, s.Init()
}

func (s Storage) Init() error {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS powerbox_proxy_tokens (
		url TEXT NOT NULL,
		token TEXT NOT NULL
	)`)
	return err
}

func (s Storage) GetTokenFor(url string) (token string, err error) {
	row := s.db.QueryRow(`
		SELECT token
		FROM powerbox_proxy_tokens
		WHERE url = ?`,
		url,
	)
	err = row.Scan(&token)
	return token, err
}

func (s Storage) SetTokenFor(url, token string) error {
	_, err := s.db.Exec(
		`INSERT INTO powerbox_proxy_tokens(url, token)
		VALUES (?, ?)`,
		url, token,
	)
	return err
}
